const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

//const db = require('./bin/database/x10eDB.db');
const dbObj = require('./bin/obj');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.title = "X10e"
app.locals.email = "thevultofdeus@gmail.com"

app.all('*', (req, res, next) => {
    console.log("Authenticating....");
    next();
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow any origin to access the resource
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'); // Specify the allowed HTTP methods
    res.header('Access-Control-Allow-Headers', 'Content-Type'); // Specify the allowed headers
    next();
});

app.use('/', require('./routes/api'));

app.on('exit', function(){
    console.log("Closing...");
    db.close();
})

module.exports = app;