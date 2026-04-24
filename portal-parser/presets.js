import cstRaw from './src/CST.txt?raw';
import bsceRaw from './src/BSCE.txt?raw';
import wmaRaw from './src/WMA.txt?raw';

/**
 * Preset Curriculum Config 
 * To add a new curriculum: append { id, label, content } to this array.
 */
export const PRESET_CURRICULA = [
    {
        id: 'cst',
        label: '🛡️ Cybersecurity Technology (BSIT)',
        content: cstRaw
    },
    {
        id: 'bsce',
        label: '🏗️ Civil Engineering (BSCE)',
        content: bsceRaw
    },
    {
        id: 'wma',
        label: '📱 Web and Mobile Applications (BSIT)',
        content: wmaRaw
    }
];

export const CURRICULA_CREDITS = {
    cst: 'Kenneth Davila',
    bsce: 'Aristotle Jr Siton',
    wma: 'Miles Tan'
};

