"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const fs = require('fs');
const csv = require("csv-parser");
const path = require('path');
const app = express();
const PORT = 3000;
let courses = [];
const readCsv = (filePath) => {
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
        courses.push(row);
    })
        .on('end', () => {
        console.log('Fichier CSV chargé avec succès.');
    });
};
readCsv(path.join(__dirname, 'cours.csv'));
//app.use(express.static(__dirname));
// Servir les fichiers statiques depuis le dossier dist
app.use(express.static(path.join(__dirname, '../dist')));
app.get('/data', (req, res) => {
    res.json(courses);
});
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
