const fs = require('fs');
const path = require('path');

const check = () => {
    const root = 'c:\\Users\\nisha\\OneDrive\\Pictures\\KiyaanProject\\zirakbook';
    const s1 = path.join(root, 'Frontend Today/src/services/purchaseBillService.js');
    
    if (fs.existsSync(s1)) {
        console.log(`Found: ${s1}`);
        console.log(fs.readFileSync(s1, 'utf8'));
    } else {
        console.log("purchaseBillService.js not found!");
    }
};

check();
