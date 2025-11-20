const express = require('express');
import { Request, Response } from 'express'; 
const fs = require('fs');
import csv = require('csv-parser');
const path = require('path');

interface CourseData {
    'Numéros de la semaine': string;
    'Numéros du cours': string;
    'Dates': string;
}

const app = express();
const PORT: number = 3000;

let courses: CourseData[] = [];

const readCsv = (filePath: string): void => {
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: CourseData) => {
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

app.get('/data', (req: Request, res: Response) => {
    res.json(courses);
});

app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
