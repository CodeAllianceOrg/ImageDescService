class DynamicDescription < ActiveRecord::Base
  validates :body, :length => { :maximum => 16384 } , :presence => true
  validates :submitter, :length => { :maximum => 255 }
  validates :dynamic_image_id, :presence => true

  belongs_to :dynamic_image
end