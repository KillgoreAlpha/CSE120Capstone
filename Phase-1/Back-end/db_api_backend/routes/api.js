const express = require('express');
const X10EDatabase = require('../bin/database.js');
const router = express.Router();

router.get('/conditions', async (req, res) => {
    try {
        const conditions = await X10EDatabase.GetAllConditions();
        res.json(conditions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/conditions', async (req, res) => {
    const { condition_name } = req.body;
    try {
        const result = await X10EDatabase.AddCondition(condition_name);
        res.json({ success: true, condition_id: result.condition_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/medications', async (req, res) => {
    try {
        const medications = await X10EDatabase.GetAllMedications();
        res.json(medications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/medications', async (req, res) => {
    const { medication_name } = req.body;
    try {
        const result = await X10EDatabase.AddMedication(medication_name);
        res.json({ success: true, medication_id: result.medication_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const users = await X10EDatabase.GetAllUserPersonalData();
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/users', async (req, res) => {
    const userData = req.body;
    try {
        const result = await X10EDatabase.AddUserPersonalData(userData);
        res.json({ success: true, patient_id: result.patient_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/interstitial_fluid_elements', async (req, res) => {
    try {
        const elements = await X10EDatabase.GetAllInterstitialFluidElements();
        res.json(elements);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/interstitial_fluid_elements', async (req, res) => {
    const element = req.body;
    try {
        const result = await X10EDatabase.AddInterstitialFluidElement(element);
        res.json({ success: true, element_id: result.element_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/accounts', async (req, res) => {
    try {
        const accounts = await X10EDatabase.GetAllAccounts();
        res.json(accounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/accounts', async (req, res) => {
    const account = req.body;
    try {
        const result = await X10EDatabase.AddAccount(account);
        res.json({ success: true, account_id: result.account_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/signIn', async (req, res) => {
    const { email, password } = req.body;
    try {
        const account = await X10EDatabase.GetAccountByEmail(email);
        if (!account)
            return res.status(404).json({ error: 'Account not found' });
        if (account.password !== password)
            return res.status(401).json({ error: 'Incorrect password' });

        res.status(200).json({ success: true, account_id: account.account_id, first_name: account.first_name, last_name: account.last_name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.put('/accounts/:id', async (req, res) => {
    const { id } = req.params;
    const accountData = req.body;
    try {
        const result = await X10EDatabase.UpdateAccountById(id, accountData);
        if (result)
            res.json({ success: true, message: 'Account updated successfully' });
        else
            res.status(404).json({ error: 'Account not found' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/accounts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const account = await X10EDatabase.GetAccountById(id);
        if (account)
            res.json(account);
        else
            res.status(404).json({ error: 'Account not found' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;