const mongoose = require('mongoose')

const codeChangeSchema = new mongoose.Schema({
    roomId: String,
    data: []
  });
  
  const CodeChange = mongoose.model('CodeChange', codeChangeSchema);

  module.exports = CodeChange