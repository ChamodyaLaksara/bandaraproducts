const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Wc@22431",
  database: "business_db"
});

module.exports = db;