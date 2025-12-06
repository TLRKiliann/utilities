import type { DataType, ItemsType, InformationsType, EndDatesYearsTypes } from "./types/types";
const dotenv = require('dotenv');
const cron = require('node-cron');
const express = require("express");
const fs = require('fs').promises;
const path = require("path");
import { parseDate, functionDate, formatUpdateFriday, deuxDernieresSemaines, generateCourseDates } from './utils/dateUtils';
dotenv.config();

const UPDATE_FILE = path.join(__dirname, "./utils/update-dates.json");

const app = express();
const PORT: number = 3000;

// Retrieve informations from CMS Collection
const informations: InformationsType[] = [];

// Load from JSON file
const loadUpdateDates = async (): Promise<string[]> => {
    try {
        const data = await fs.readFile(UPDATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
};

let dateToUpdate: string[] = [];

// On charge les données au démarrage
(async () => {
    dateToUpdate = await loadUpdateDates();
})();

// Save in JSON file (async)
const saveUpdateDates = async (): Promise<void> => {
    try {
        await fs.writeFile(UPDATE_FILE, JSON.stringify(dateToUpdate, null, 2), 'utf8');
        console.log("Update standard saved successfully!");
    } catch (err) {
        console.error("Erreur lors de la sauvegarde standard :", err);
    }
};

// Erase JSON file completely & write new value of date (new year)
const overwriteFile = async (): Promise<void> => {
    try {
        await fs.writeFile(UPDATE_FILE, JSON.stringify(dateToUpdate, null, 2), "utf8");
        console.log(`Le fichier ${UPDATE_FILE} a été écrasé avec succès.`);
    } catch (err) {
        console.error('Erreur lors de l\'écriture du fichier', err);
    }
};

// -----------
// UPDATE CMS
// -----------
const updateCMSItem = async (itemId: string, idValue: number, nouvelleDate: string): Promise<void> => {
    try {
        const response = await fetch(
            `https://api.webflow.com/v2/collections/${process.env.COLLECTION_ID}/items/${itemId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                        "accept-version": "2.0.0"
                    },
                    body: JSON.stringify({
                        fieldData: {
                        "id-value": String(idValue),
                        date: nouvelleDate
                        }
                    })
                }
        );
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erreur PATCH Webflow :", errorData);
            return;
        }
        //const data = await response.json();
        console.log(`Item ${itemId} mis à jour avec succès:`, nouvelleDate);
        //return;
    } catch (err) {
        console.error("Erreur lors du PATCH :", err);
        return;
    }
};

// -----------------------------
// LOGIQUE TRAITEMENT DES DATES
// -----------------------------
const handleIdValue = async (
    itemId: string,
    idValue: number,
    date: string,
    semaine: string,
    cours: string,
    dateFormattedToday: string
): Promise<void> => {

    const formatData: Date = parseDate(date);
    const formatUpdateData: Date = parseDate(date);

    console.log("Date du jour:", dateFormattedToday);

    /*  
        Update des dates dans la CMS Collection, 63 jours après
        la date inscrite dans la CMS Collection, selon (update)
    */
    let nextDate: string = functionDate(formatData); // Déjà +63j !!!
    // Update prog dans 8 semaines, le vendredi à 08:00
    const update: string = formatUpdateFriday(formatUpdateData);
    // Si les dates tombent sur les vacances
    const noDates: string = "--/--/----";

    /*
        Génère des dates pour les 8ère semaines de l'année
        pour n'importe quelle année, à partir du vendredi
        de la semaine du nouvel an. Soit 1 semaine avant
        la génération des dates pour les 8 semaines.
    */
    const currentYear: number = new Date().getFullYear();
    let coursesForStartYear: {day: string, date: string}[] = generateCourseDates(currentYear);
    console.log(coursesForStartYear);

    /*
        Calcul des 2 dernières semaines de l'année en cours.
        La 1ère comprend Noël et la seconde comprend nouvel an.
    */
    const lastWeeksPerYear: EndDatesYearsTypes = deuxDernieresSemaines(currentYear);
    // 1er et second lundi des vacances
    const firstLundiVacances: string = lastWeeksPerYear.avantDerniereSemaine.debut;
    const secondLundiVacances: string = lastWeeksPerYear.derniereSemaine.debut;
    // 1er et second vendredi des vacances
    //const firstFridayHoliday: string = lastWeeksPerYear.avantDerniereSemaine.fin;
    //const secondFridayHoliday: string = lastWeeksPerYear.derniereSemaine.fin;

    //console.log("+ Dates 1er lundi et 1er vendredi (vacances)", firstLundiVacances, firstFridayHoliday);
    //console.log("++ Dates 2er lundi et 2er vendredi (vacances)", secondLundiVacances, secondFridayHoliday);


    const aujourdHui: Date = new Date();
    const moisActuel: number = aujourdHui.getMonth();
    const premierJourAnnee = new Date(aujourdHui.getFullYear(), 0, 1);

    if (moisActuel > 0) {
        // +63j
        console.log("Mois actuel > 1", moisActuel);

        if ((nextDate === firstLundiVacances) || (nextDate === secondLundiVacances)) {
            const currentIndex = informations.findIndex((info: { idValue: number; }) => 
                info.idValue === idValue
            );
            if (currentIndex !== -1) { // 18 = 2 x 9 cours = 2 semaines vacances
                for (let i = currentIndex; i < informations.length; i++) {
                    const nextItem = informations[i];
                    console.log("!!! Ces dates tombent sur la 1ère semaine vacances !!!",
                        nextItem.idValue, noDates, nextItem.cours);
                    //await updateCMSItem(nextItem.itemId, nextItem.idValue, noDates);
                }
                // !!! PAS de UPDATE !!!
            }
            return;
        } else if ((nextDate !== firstLundiVacances) && (nextDate !== secondLundiVacances)) {
            console.log(`MAJ du CMS par idValue ${idValue}: ${nextDate}`, "correspondant à",
                `Semaine ${semaine}`, cours);

            if (idValue === 1) {
                dateToUpdate.push(update);
                await saveUpdateDates();
                console.log("Update programmer pour dans 8 semaines !");
                //await updateCMSItem(itemId, idValue, nextDate); // idValue === 1
                //return;
            }
            //await updateCMSItem(itemId, idValue, nextDate);
        }
    } else if (aujourdHui === premierJourAnnee) {
        // générer les dates pour 8 semaines
        dateToUpdate.push(update);
        await saveUpdateDates();
        console.log("On est le 1er jour de l'année !!!");
        for (let course of coursesForStartYear) {
            // console.log(`Date: ${course.date}`);
            await updateCMSItem(itemId, idValue, course.date);
        };
        return;
        // let coursesForStartYear: {day: string, date: string}[] = generateCourseDates(currentYear);
        // await updateCMSItem(itemId, idValue, coursesForStartYear);
    } else {
        console.log("!!! Pas de nouvelles dates ni de update !!!");
    };
};

// -----------------------------
// PUBLICATION SUR SITE WEBFLOW
// -----------------------------
const publishSite = async (): Promise<InformationsType | null> => {
    try {
        const response = await fetch(
            `https://api.webflow.com/v2/sites/${process.env.SITE_ID}/publish`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                        "accept-version": "2.0.0",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        "customDomains": [process.env.DOMAIN_ID_1, process.env.DOMAIN_ID_2],
                        "publishToWebflowSubdomain": false
                    }),
                }
        );
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erreur lors de la publication :", errorData);
            return null;
        }
        const data = await response.json() as InformationsType;
        console.log("Site publié avec succès !");
        return data;
    } catch (err) {
        console.error("Erreur lors de la publication :", err);
        return null;
    }
};
// ---------------
// FETCH CMS DATA
// ---------------
const fetchCMSData = async (): Promise<InformationsType[] | string> => {
    const response = await fetch(
        `https://api.webflow.com/v2/collections/${process.env.COLLECTION_ID}/items?offset=0&limit=100`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                    'accept-version': '2.0.0'
                }
            }
    );
    const data = await response.json() as DataType;
    console.log("data", data);
    try {
        if (data.items && data.items.length > 0) {
            data.items.forEach((item: ItemsType) => {
                //console.log(item.fieldData);
                const date: string = item.fieldData.date;
                const semaine: string = item.fieldData.semaine;
                const cours: string = item.fieldData.cours;
                const itemId: string = item.id;
                const idValue: number = Number(item.fieldData["id-value"]);
                if (idValue && semaine && date && cours) {
                    informations.push({ itemId, idValue, semaine, date, cours });
                }
            });
        }
    } catch (err) {
        console.log("Erreur avec data.items", err);
    }
    // Fixe la date du jour
    const now: Date = new Date();
    /*
        test la date du jour avec 08:00 (il faut supprimer pour la version finale)!!!
    */
    const dateFormattedToday: string = `${String(now.getDate()).padStart(2, "0")}/` +
                                    `${String(now.getMonth() + 1).padStart(2, "0")}/` +
                                    `${String(now.getFullYear())}`;

    now.setHours(8, 0, 0, 0);
    const formattedDateHoursMin: string = `${String(now.getDate()).padStart(2, "0")}/` +
                                `${String(now.getMonth() + 1).padStart(2, "0")}/` +
                                `${String(now.getFullYear())}` +
                                ` ${String(now.getHours()).padStart(2, "0")}:` + 
                                `${String(now.getMinutes()).padStart(2, "0")}`;
    console.log("*** formattedDateHoursMin ***", formattedDateHoursMin);
    /*
        Vérifie si la date du jour correspond à la date
        du dernier UPDATE programmé (JSON file)!
    */
    const lastDateRecorded: string | undefined = dateToUpdate.at(-1);
    console.log("** lastDateRecorded **", lastDateRecorded);
    console.log("formattedDateHoursMin", formattedDateHoursMin);

    if (lastDateRecorded === formattedDateHoursMin) {
        try {
            //Ordonne la sortie des data par id_value ASC
            informations.sort((a, b) => a.idValue - b.idValue);
            //console.log("informations:", informations);
            for (let idValueToUpdate = 1; idValueToUpdate <= 36; idValueToUpdate++) {
                const item: InformationsType | undefined = informations.find((
                    info: InformationsType) => 
                        info.idValue === idValueToUpdate
                );
                if (item) {
                    await handleIdValue(
                        item.itemId,
                        item.idValue,
                        item.date,
                        item.semaine,
                        item.cours,
                        dateFormattedToday
                    )
                };
            };
        } catch (err) {
            console.log("Erreur lors avec informations.sort() et informations.forEach()", err);
        }
        //await publishSite();
        return informations;
    } else {
        console.log("Nothing to update !", formattedDateHoursMin);
        return formattedDateHoursMin;
    }
};
//fetchCMSData();

/*
    Fonction cron qui sert à lancer la function fetchCMSData();
    Le lancement est programmé pour chaque vendredi à 08:00 ("* 8 * * 5")
*/
cron.schedule("20 8 * * 1", async () => {
    const now = new Date();
    console.log("------ Cron Job lancé ------");
    console.log(`Date et heure actuelles : ${now.toLocaleString()}`);
    console.log("fetchCMSData() va s'exécuter maintenant !");
    try {
        await fetchCMSData();
        console.log("fetchCMSData() terminé avec succès !");
    } catch (err) {
        console.error("Erreur lors de fetchCMSData :", err);
    }
    console.log("---------------------------");
});

app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});