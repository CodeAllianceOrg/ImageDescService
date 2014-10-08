//Edit Image.
define([
  'jquery',
  'underscore',
  'backbone',
  'ckeditor',
  'bootstrap',
  '/javascripts/models/dynamic_image.js',
  '/javascripts/models/dynamic_description.js',
  'text!/javascripts/templates/edit_image.html'
], function($, _, Backbone, ckeditor, bootstrap, DynamicImage, DynamicDescription, editImageTemplate){
  var EditImageView = Backbone.View.extend({
    
    //div.
    tagName:  "div",

    events: {
      "change .should_be_described": "saveNeedsDescription",
      "change .image_category": "saveImageCategory",
      "click .open-edit-view": "openEditor",
      "click .cancel": "cancelEditor",
      "click .save-text": "saveDescription",
      "click .save-mathml": "saveMathML",
      "click .edit": "showDynamicDescriptionForm",
      "click .preview": "showPreview",
      "click .view_sample": "showSample",
      "click .history_link": "showDescriptionHistory",
      "keyup .math-editor": "getMathML"
    },

    jax: {},

    ckeditorConfig: {
        extraPlugins: 'onchange',
        minimumChangeMilliseconds: 100,
        scayt_autoStartup:true,
        toolbar :
        [
            { name: 'basicstyles', items : [ 'Bold','Italic','Underline' ] },
            { name: 'paragraph', items : [ 'NumberedList','BulletedList' ] },
            { name: 'editing', items : ['Scayt' ] },
            { name: 'styles', items : [ 'Format' ] },
            { name: 'insert', items : [ 'Table','Link','Unlink' ] },
            { name: 'tools', items : [ 'Undo', 'Redo', '-', 'Source','Maximize' ] }
        ]
    },

    render: function() {
      var compiledTemplate = _.template( editImageTemplate, 
        { 
          image: this.model, 
          image_categories: this.imageCategories.models, 
          previousImage: this.previousImage,
          nextImage: this.nextImage
        });
      if (this.model.has("image_category_id") && $("#example-" + this.model.get("image_category_id")).html().length > 0) {
        this.$(".view_sample").show();
      } else {
        this.$(".view_sample").hide();
      }
      this.$el.html(compiledTemplate);
      return this;
    },

    saveImageCategory: function(e) {
      var imageView = this;
      var imageCategory = $(e.currentTarget).val();
      //Save.
      imageView.model.save({"image_category_id": imageCategory});
      if (!$("#example-" + imageCategory).html().length > 0) {
        imageView.$(".view_sample").hide();
      } else {
        imageView.$(".view_sample").show();
      }
      if (imageCategory == "10") {
        imageView.$(".math-tab").show();
      }
    },

    saveNeedsDescription: function(e) {
      var shouldBeDescribed = $(e.currentTarget).val();
      //First, update the image.
      this.model.save({"should_be_described": shouldBeDescribed});
      if (shouldBeDescribed == "true") {
        this.showDynamicDescriptionForm();
      }
    },

    openEditor: function(e) {
      e.preventDefault(e);
      this.showDynamicDescriptionForm();
      $(e.currentTarget).hide();
    },

    showDynamicDescriptionForm: function() {
      var editView = this;
      editView.$(".update-message").html("");
      var longDescription = editView.$(".long-description");
      var textarea = $(".dynamic-description", $(longDescription));
      textarea.ckeditor(editView.ckeditorConfig);

      editView.model.fetch({
        success: function() {
          var latestDescription = editView.model.has("dynamic_description") ? editView.model.get("dynamic_description")["body"] : "";
          textarea.val(latestDescription);
          var name = textarea.attr("name");
          CKEDITOR.instances[name].setData(latestDescription);
          //make sure that the description is up to date.
          longDescription.show();
          //Show edit tab.
          $("#edit-tab-" + editView.model["id"]).tab('show');
          //hide math tab for non-math equations.
          if (editView.$(".image_category").val() != "10") {
            editView.$(".math-tab").hide();
          }
        }    
      });
    },

    cancelEditor: function(e) {
      e.preventDefault();
      this.$(".long-description").hide();
    },

    showPreview: function(e) {
      var editView = this;
      editView.model.fetch({
        success: function() {
          editView.$(".image_description").html(editView.model.has("dynamic_description") ? 
            editView.model.get("dynamic_description")["body"] : "");
        }
      });
      
    },

    saveDescription: function(description) {
      var editView = this;
      var dynamicDescription = new DynamicDescription();
      dynamicDescription.save(
        {
          "book_id": $("#book_id").val(), 
          "dynamic_description": description, 
          "dynamic_image_id": editView.model.get("id")
        }, 
        {
          success: function () {
            editView.$(".image_description").html(description);
            editView.$(".text-success").html("The description has been saved.");
          },
          error: function (model, response) {
            editView.$(".text-danger").html("There was an error saving this description.");
          }
        }
      );
    },

    saveTextDescription: function(e) {
      var editView = this;
      e.preventDefault();
      //Create a new description.
      var dynamicDescription = new DynamicDescription();
      //Get value from ckeditor.
      editView.$("textarea.dynamic-description").ckeditor(function(textarea){
        editView.saveDescription($(textarea).val());
      });
    },

    saveMathML: function(e) {
      var editView = this;
      e.preventDefault();
      //get mathml.
      editView.saveDescription(editView.jax.visual.root.toMathML());
    },

    showSample: function(e) {
      var editImage = this;
      $(e.currentTarget).popover({
        html : true, 
        content: function() {
          var content = $('#example-' + editImage.$(".image_category").val()).clone();
          content.css("display", "block");
          return content;
        },
        title: function() {
          return "Guidelines";
        }
      });
      $(e.currentTarget).popover('show');
    },

    showDescriptionHistory: function(e) {
      e.preventDefault();
      var historyLink = $(e.currentTarget);
      var content = $.get(historyLink.attr("href"), function(d) {
        historyLink.popover({
          html : true, 
          content: function() {
            console.log($("#descriptionHistory", d));
            var content = $("#descriptionHistory", d);
            content.css("display", "block");
            return content;
          },
          title: function() {
            return "Description History";
          }
        });
        historyLink.popover('show');
      });
    },

    getMathML: function(e) {
      var editImage = this;
      console.log("Getting mathml");
      var s = $(e.currentTarget).val();
      editImage.$(".typeset-math").text("`" + s + "`");
      MathJax.Callback.Queue(
        ["Typeset", MathJax.Hub, editImage.$(".typeset-math")[0]],
        [function() { editImage.jax.visual = MathJax.Hub.getAllJax(editImage.$(".typeset-math")[0])[0]; }],
        [function() { editImage.$(".math-editor").html(editImage.sanitizeMathML(editImage.jax.visual.root.toMathML()));}]);
    },

    sanitizeMathML: function(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }


  });
  return EditImageView;
});
