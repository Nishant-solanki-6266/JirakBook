const fs = require('fs');

const find = () => {
    const filePath = 'Frontend Today/src/pages/company/Sales/Invoice/Invoice.jsx';
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('const resetForm') || line.includes('resetForm =')) {
            console.log(`Found resetForm on line ${index + 1}: ${line}`);
            for (let i = index; i < index + 40; i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
        }
    });
};

find();
