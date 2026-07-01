const fs = require('fs');
const path = require('path');

const getFilesRec = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRec(fullPath));
        } else if (file.toLowerCase().includes('axios')) {
            results.push(fullPath);
        }
    });
    return results;
};

const check = () => {
    const root = 'c:\\Users\\nisha\\OneDrive\\Pictures\\KiyaanProject\\zirakbook\\Frontend Today';
    const matches = getFilesRec(root);
    console.log(matches);
};

check();
