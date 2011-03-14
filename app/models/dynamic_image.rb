class DynamicImage < ActiveRecord::Base
  validates :uid,  :presence => true, :length => { :maximum => 255 }
  validates :image_location,  :presence => true, :length => { :maximum => 255 }
  validates :title, :length => { :maximum => 255 }

  has_many :dynamic_descriptions
end