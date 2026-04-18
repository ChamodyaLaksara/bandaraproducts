
const mysql = require("mysql2");

const db = mysql.createPool({
  host: "roundhouse.proxy.rlwy.net",
  user: "root",
  password: "Wc@22431",
  database: "railway",
  port: 55108
});

module.exports = db;

