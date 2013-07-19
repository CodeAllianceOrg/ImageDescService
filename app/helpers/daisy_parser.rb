include DaisyUtils, UnzipUtils, EpubUtils
class DaisyParser <  S3UnzippingJob
  
   DAISY_XSL = 'app/views/xslt/daisyTransform.xsl'
  
   def self.daisy_xsl
     DAISY_XSL
   end
   
   def perform
      begin
          book = Book.where(:id => book_id).first
          p "ESH: 0000, repository is a Class? = #{repository.is_a?(Class)}"
          p "ESH: 1111, have repository = #{repository.name}"
          p "ESH: 2222, #{repository.inspect}"
          file = repository.read_file(book.uid + ".zip", File.join( "", "tmp", "#{book.uid}.zip"))
          book_directory  = accept_book(file)

  
          xml = get_xml_from_dir(book_directory, book.file_type)

          doc = Nokogiri::XML xml
          opf = get_opf_from_dir(book_directory)
      
          contents_filename = get_daisy_contents_xml_name(book_directory)

          book = Book.where(:id => book_id).first
          book = update_daisy_book_in_db(book, doc, File.basename(contents_filename), opf, uploader_id)

          splitter = SplitXmlHelper::DTBookSplitter.new(IMAGE_LIMIT)
          parser = Nokogiri::XML::SAX::Parser.new(splitter)

          # Send some XML to the parser
          parser.parse(xml)

          xsl_filename = DaisyParser.daisy_xsl
          xsl = File.read(xsl_filename)

          # Keep track of the original img src attribute and whether it has been used already
          image_srces = []


          # in case this is a re-upload, we should reset the book_fragment_id of the images
          DynamicImage.update_all({:book_fragment_id => nil}, {:book_id => book.id})
          splitter.segments.each_with_index do |segment_xml, i|
            sequence_number = i+1
            book_fragment = BookFragment.where(:book_id => book.id, :sequence_number => sequence_number).first || BookFragment.create(:book_id => book.id, :sequence_number => sequence_number)
            doc = Nokogiri::XML segment_xml

            create_images_in_database(book, book_fragment, book_directory, doc)

            doc.css('img').each do |img_node| 
              unless (img_node['src']).blank?
                db_image = DynamicImage.where(:book_id => book.id, :image_location => img_node['src']).first
                if db_image
                  img_node['img-id'] = db_image.id.to_s
                  img_node['original'] = image_srces.include?(img_node['src']) ? '0' : '1' 
                end
                image_srces << img_node['src']
              end
            end
            segment_xml = doc.to_xml

            book.update_attribute("status", 2) if i == 0

            contents = repository.xslt(segment_xml, xsl) # don't do that for epub files only read contents
            content_html = File.join("","tmp", "#{book.uid}_#{sequence_number}.html")
            File.open(content_html, 'wb'){|f|f.write(contents)}
            repository.store_file(content_html, book.uid, "#{book.uid}/#{book.uid}_#{sequence_number}.html", nil)
          end

          book.update_attribute("status", 3) 
          doc = nil
          xml = nil
          current_user = User.where(:id => uploader_id).first
          UserMailer.book_uploaded_email(current_user, book).deliver #email 'current user'

          # remove zip file from holding bucket
          repository.remove_file(book.uid + ".zip")

          daisy_file = nil

        rescue Exception => e
            puts "Unknown problem in unzipping job for book #{book ? book.uid : ''}"
            puts "#{e.class}: #{e.message}"
            puts e.backtrace.join("\n")
            $stderr.puts e
      end
    end
    
    def get_opf_from_dir (book_directory)
      opf_filename = Dir.glob(File.join(book_directory, '*.opf'))[0]
      File.read(opf_filename)
    end
    
    def update_daisy_book_in_db(book, doc, xml_file, opf, uploader)
      isbn = nil
      if opf
        opf_doc = Nokogiri::XML opf
        isbn = extract_optional_isbn(opf_doc)
      end
      @book_title = extract_optional_book_title(doc)
      @book_publisher = extract_optional_book_publisher(doc)
      @book_publisher_date = extract_optional_book_publisher_date(doc)
      book.update_attributes(:title => @book_title, :isbn => isbn, :xml_file => xml_file, :status => 1, :publisher => @book_publisher, :publisher_date => @book_publisher_date)    
      book
    end
    
    def extract_optional_isbn(doc)
      matches = doc.xpath("//dc:Identifier[@scheme='ISBN']", 'dc' => 'http://purl.org/dc/elements/1.1/')
      if matches.size != 1
        return nil
      end
      node = matches.first
      node.text
    end
    
    
    def extract_optional_book_title(doc)
      xpath_title = "//xmlns:meta[@name='dc:Title']"
      matches = doc.xpath(doc, xpath_title)
      if matches.size != 1
        return nil
      end
      node = matches.first
      node.attributes['content'].content
    end
    
    
    def extract_optional_book_publisher(doc)
      xpath_publisher = "//xmlns:meta[@name='dc:Publisher']"
      matches = doc.xpath(doc, xpath_publisher)
      if matches.size == 0
        return nil
      end
      node = matches.first
      node.attributes['content'].content
    end

    def extract_optional_book_publisher_date(doc)
       xpath_date = "//xmlns:meta[@name='dc:Date']"
       matches = doc.xpath(doc, xpath_date)
       if matches.size != 1
         return nil
       end
       node = matches.first
       node.attributes['content'].content
    end

    def get_image_path(book_directory, image_location)
       File.join(book_directory, image_location)
    end
  
end