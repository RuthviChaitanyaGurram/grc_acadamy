const topicKeyInput = document.getElementById("topicKey");
const examTypeInput = document.getElementById("examType");
const topicNameInput = document.getElementById("topicName");
const csvFileInput = document.getElementById("csvFile");
const csvTextInput = document.getElementById("csvText");
const parseBtn = document.getElementById("parseBtn");
const parseStatus = document.getElementById("parseStatus");
const outputText = document.getElementById("outputText");
const downloadBtn = document.getElementById("downloadBtn");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === "\"" && inQuotes && nextChar === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function escapeJsString(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function buildTopicFile(topicKey, rows, exam, topicName) {
  const objects = rows.map((row) => {
    const [id, question, optionA, optionB, optionC, optionD, answerLetter, explanation, trick] = row;
    const letter = (answerLetter || "").toUpperCase();
    const answerMap = { A: 0, B: 1, C: 2, D: 3 };
    const answerIndex = answerMap[letter];

    if (answerIndex === undefined) {
      throw new Error(`Invalid answerLetter "${answerLetter}" for question id ${id}. Use A/B/C/D.`);
    }

    return `  {
    id: ${Number(id)},
    exam: "${escapeJsString(exam)}",
    topic: "${escapeJsString(topicName)}",
    question: "${escapeJsString(question)}",
    options: ["${escapeJsString(optionA)}", "${escapeJsString(optionB)}", "${escapeJsString(optionC)}", "${escapeJsString(optionD)}"],
    answerIndex: ${answerIndex},
    explanation: "${escapeJsString(explanation)}",
    trick: "${escapeJsString(trick)}"
  }`;
  });

  return `window.TOPIC_QUESTION_DATA = window.TOPIC_QUESTION_DATA || {};
window.TOPIC_QUESTION_DATA.${topicKey} = [
${objects.join(",\n")}
];
`;
}

function parseCsvText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV needs header + at least one data row.");
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = ["id", "question", "optiona", "optionb", "optionc", "optiond", "answerletter", "explanation", "trick"];
  const validHeader = expected.every((key, idx) => header[idx] === key);
  if (!validHeader) {
    throw new Error("CSV header format invalid. Use: id,question,optionA,optionB,optionC,optionD,answerLetter,explanation,trick");
  }

  const rows = lines.slice(1).map(parseCsvLine);
  rows.forEach((row, index) => {
    if (row.length < 9) {
      throw new Error(`Row ${index + 2} is incomplete. Each row needs 9 columns.`);
    }
  });

  return rows;
}

async function readSelectedFile() {
  const file = csvFileInput.files?.[0];
  if (!file) return "";
  return file.text();
}

parseBtn.addEventListener("click", async () => {
  try {
    const topicKey = topicKeyInput.value.trim();
    const topicName = topicNameInput.value.trim();
    const exam = examTypeInput.value;
    if (!topicKey || !topicName) {
      throw new Error("Please fill Topic File Key and Topic Name.");
    }

    const fileText = await readSelectedFile();
    const rawText = csvTextInput.value.trim() || fileText.trim();
    if (!rawText) {
      throw new Error("Please upload or paste CSV content.");
    }

    const rows = parseCsvText(rawText);
    const jsOutput = buildTopicFile(topicKey, rows, exam, topicName);
    outputText.value = jsOutput;
    parseStatus.textContent = `Parsed ${rows.length} questions successfully.`;
  } catch (error) {
    parseStatus.textContent = error.message;
    outputText.value = "";
  }
});

downloadBtn.addEventListener("click", () => {
  if (!outputText.value.trim()) {
    parseStatus.textContent = "No parsed output to download. Click Parse CSV first.";
    return;
  }
  const key = topicKeyInput.value.trim() || "topic_questions";
  const blob = new Blob([outputText.value], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${key}.js`;
  a.click();
  URL.revokeObjectURL(url);
});
