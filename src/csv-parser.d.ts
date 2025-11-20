declare module 'csv-parser' {
    import { Transform } from 'stream';

    interface Options {
        headers?: string[] | boolean;
        separator?: string;
        skip?: number;
        // Ajoutez d'autres options si nécessaire.
    }

    function csvParser(options?: Options): Transform;

    export = csvParser;
}
