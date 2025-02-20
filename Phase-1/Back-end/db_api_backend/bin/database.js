const sqlite3 = require('sqlite3');
const db_path = "./bin/database/x10eDB.db";
const dbObj = require('./obj');

class X10EDatabase {
    constructor(db) {
        this.db = new sqlite3.Database(db_path, sqlite3.OPEN_READWRITE, (err) => {
            if(err) console.error(err.message);
            console.log("Opened database");
        })
    }

    close() {
        this.db.close((err)=>{
            if(err) console.error(err.message);
            console.log("Closed database");
        })
    }
}

X10EDatabase.prototype.GetAllConditions = function() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Conditions`;
        this.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

X10EDatabase.prototype.AddCondition = function(conditionName) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO Conditions (condition_name) VALUES (?)`;
        this.db.run(sql, [conditionName], function(err) {
            if (err) reject(err);
            resolve({ condition_id: this.lastID });
        });
    });
};

X10EDatabase.prototype.GetAllMedications = function() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Medications`;
        this.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

X10EDatabase.prototype.AddMedication = function(medicationName) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO Medications (medication_name) VALUES (?)`;
        this.db.run(sql, [medicationName], function(err) {
            if (err) reject(err);
            resolve({ medication_id: this.lastID });
        });
    });
};

X10EDatabase.prototype.GetAllUserPersonalData = function() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM UserPersonalData`;
        this.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

X10EDatabase.prototype.AddUserPersonalData = function(userData) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO UserPersonalData 
            (name, age, gender, date_of_visit, previous_visits, diet_type_id, physical_activity_level_id, is_smoker, alcohol_consumption_id, blood_pressure, weight_kg, height_cm, bmi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            userData.name, userData.age, userData.gender, userData.date_of_visit, userData.previous_visits,
            userData.diet_type_id, userData.physical_activity_level_id, userData.is_smoker, userData.alcohol_consumption_id,
            userData.blood_pressure, userData.weight_kg, userData.height_cm, userData.bmi
        ];

        this.db.run(sql, params, function(err) {
            if (err) reject(err);
            resolve({ patient_id: this.lastID });
        });
    });
};

X10EDatabase.prototype.GetAllInterstitialFluidElements = function() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM InterstitialFluidElement`;
        this.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

X10EDatabase.prototype.AddInterstitialFluidElement = function(element) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO InterstitialFluidElement 
            (element_name, upper_limit, lower_limit, upper_critical_limit, lower_critical_limit)
            VALUES (?, ?, ?, ?, ?)`;

        const params = [
            element.element_name, element.upper_limit, element.lower_limit, element.upper_critical_limit, element.lower_critical_limit
        ];

        this.db.run(sql, params, function(err) {
            if (err) reject(err);
            resolve({ element_id: this.lastID });
        });
    });
};

X10EDatabase.prototype.GetAllAccounts = function() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Account`;
        this.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

X10EDatabase.prototype.AddAccount = function(account) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO Account 
            (email, password, level_id, user_data_id, first_name, last_name)
            VALUES (?, ?, ?, ?, ?, ?)`;

        const params = [account.email, account.password, account.level_id, account.user_data_id, account.first_name, account.last_name];

        this.db.run(sql, params, function(err) {
            if (err) reject(err);
            resolve({ account_id: this.lastID });
        });
    });
};

X10EDatabase.prototype.GetAccountById = function(accountId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Account WHERE AccountID = ?`;
        this.db.get(sql, [accountId], (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}

X10EDatabase.prototype.UpdateAccountById = function(accountId, accountData) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE Account SET email = ?, password = ?, level_id = ?, first_name = ?, last_name = ? WHERE AccountID = ?`;
        const params = [accountData.email, accountData.password, accountData.level_id, accountData.first_name, accountData.last_name, accountId];
        this.db.run(sql, params, function (err) {
            if (err) reject(err);
            resolve(this.changes > 0);
        });
    });
}

X10EDatabase.prototype.GetAccountByEmail = function(email) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM Account WHERE email = ?`;
        this.db.get(sql, [email], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


module.exports = new X10EDatabase