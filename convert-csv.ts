import fs from 'fs';

function parseCSVLine(line: string) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const csvData = fs.readFileSync('./src/data/questions.csv', 'utf-8');
const lines = csvData.split('\n');
const questions = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const values = parseCSVLine(lines[i]);
  if (values.length < 19) continue;

  const idRaw = values[0];
  const complexity = parseInt(values[1]);
  const category = values[2];
  const questionText = values[3];
  
  const id = `PSM-${idRaw.padStart(3, '0')}`;
  const applicableLevels = [];
  for (let l = complexity; l <= 5; l++) {
    applicableLevels.push(l);
  }

  questions.push({
    id,
    text: questionText,
    category,
    applicable_levels: applicableLevels,
    action_plan_scarce: values[4],
    action_plan_at_least_one: values[5],
    action_plan_none: values[6],
    evidence_sufficient: values[7],
    evidence_scarce: values[8],
    evidence_at_least_one: values[9],
    evidence_none: values[10],
    evidence_not_applicable: values[11],
    auditor_guide_sufficient: values[12],
    auditor_guide_scarce: values[13],
    auditor_guide_at_least_one: values[14],
    auditor_guide_none: values[15],
    auditor_guide_not_applicable: values[16],
    legislation: values[17],
    tech_tool: values[18]
  });
}

fs.writeFileSync('./src/data/questions.json', JSON.stringify(questions, null, 2));
console.log("Converted CSV to JSON");
