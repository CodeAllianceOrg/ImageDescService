// Filename: models/equation
define([
  'underscore',
  'backbone'
], function(_, Backbone){
  var Equation = Backbone.Model.extend({
    urlRoot : '/mmlc/equation'

  });
  return Equation;
});
