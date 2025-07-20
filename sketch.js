// Bluetooth UUIDs for micro:bit UART service
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "Disconnected";

let recognition;
let transcript = ""; // speech recognition result
let recognitionStatus = "🕹️ Press the button to start voice recognition."; // status message
let feedbackEmoji = ""; // emoji feedback
let sentData = ""; // data sent to micro:bit

// Voice commands mapped to data
const voiceCommands = {
  forward: ["forward", "go forward", "straight", "start"],
  backward: ["backward", "go back", "reverse"],
  stop: ["stop", "halt", "hold"],
  left: ["left", "turn left"],
  right: ["right", "turn right"],
  ring: ["siren", "sound", "buzzer", "alarm"]
};

let userCommands = {}; // store user-added commands

function setup() {
  console.log("Setup function called"); // debug log
  const canvas = createCanvas(30, 30);
  canvas.parent("p5-container");

  // STEP1: Bluetooth connection
  createBluetoothUI();

  // STEP2: Voice command table
  createCommandTable();

  // STEP3: User command UI
  createUserCommandUI();

  // STEP4: Voice recognition control
  createVoiceRecognitionUI();

  // Initialize speech recognition object
  setupVoiceRecognition();
}

/**
 * STEP1: Create Bluetooth connection UI
 */
function createBluetoothUI() {
  console.log("Creating Bluetooth UI"); // debug log
  const statusElement = select("#bluetoothStatus");
  if (statusElement) {
    statusElement.html(`Status: ${bluetoothStatus}`);
  }

  const buttonContainer = select("#bluetooth-control-buttons");
  if (buttonContainer) {
    const connectButton = createButton("🔗 Connect").addClass("start-button");
    connectButton.mousePressed(connectBluetooth);
    buttonContainer.child(connectButton);

    const disconnectButton = createButton("❌ Disconnect").addClass("stop-button");
    disconnectButton.mousePressed(disconnectBluetooth);
    buttonContainer.child(disconnectButton);
  }
}

/**
 * STEP2: Create voice command table
 */
function createCommandTable() {
  console.log("Creating Command Table"); // 디버깅용 로그
  const tableContainer = select("#command-table-container");
  if (tableContainer) {
    const table = createElement("table");
    tableContainer.child(table);

    const header = createElement("tr");
    header.child(createElement("th", "Voice Command"));
    header.child(createElement("th", "Send Data"));
    table.child(header);

    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      table.child(row);
    });

    updateCommandTable();
  }
}

/**
 * STEP3: Add custom command UI
 */
function createUserCommandUI() {
  console.log("Creating User Command UI"); // debug log
  const inputContainer = select("#user-command-ui");
  if (inputContainer) {
    const commandInput = createInput().attribute("placeholder", "New voice command");
    inputContainer.child(commandInput);

    const dataInput = createInput().attribute("placeholder", "Data to send for command");
    inputContainer.child(dataInput);

    const addButton = createButton("➕ Add Command").addClass("start-button");
    addButton.mousePressed(() => {
      const command = commandInput.value().trim();
      const data = dataInput.value().trim();

      if (command && data) {
        userCommands[command] = [data];
        updateCommandTable();
        commandInput.value("");
        dataInput.value("");
      } else {
        alert("Please enter both command and data.");
      }
    });
    inputContainer.child(addButton);

    updateCommandTable();
  }
}

// Update command table
function updateCommandTable() {
  const table = select("table");
  if (table) {
    table.html("");
    const header = createElement("tr");
    header.child(createElement("th", "Voice Command"));
    header.child(createElement("th", "Send Data"));
    table.child(header);

    Object.entries(voiceCommands).forEach(([command, phrases]) => {
      const row = createElement("tr");
      row.child(createElement("td", phrases.join(", ")));
      row.child(createElement("td", command));
      table.child(row);
    });

    Object.entries(userCommands).forEach(([command, data]) => {
      const row = createElement("tr");
      row.child(createElement("td", command));
      row.child(createElement("td", data));
      table.child(row);
    });
  }
}

/**
 * STEP4: Create voice recognition control UI
 */
function createVoiceRecognitionUI() {
  console.log("Creating Voice Recognition UI"); // debug log
  const buttonContainer = select("#voice-recognition-ui");
  if (buttonContainer) {
    const startButton = createButton("🟢 Start Recognition").addClass("start-button");
    startButton.mousePressed(() => {
      if (!isConnected) {
        alert("Bluetooth is not connected. Please connect first.");
      } else {
        recognition.start();
        recognitionStatus = "Starting voice recognition. Speak now!";
        feedbackEmoji = "🎤";
        displayRecognitionStatus();
      }
    });
    buttonContainer.child(startButton);

    const stopButton = createButton("🔴 Stop Recognition").addClass("stop-button");
    stopButton.mousePressed(() => {
      recognition.stop();
      recognitionStatus = "Stopping voice recognition.";
      feedbackEmoji = "🤫";
      displayRecognitionStatus();
    });
    buttonContainer.child(stopButton);

    displayRecognitionStatus();
    displaySentData();
  }
}

/**
 * Display recognition status and result
 */
function displayRecognitionStatus() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let statusDiv = select("#recognitionStatus");
    if (!statusDiv) {
      statusDiv = createDiv(`${feedbackEmoji} ${recognitionStatus}`).id("recognitionStatus");
      statusDiv.addClass("control-group");
      statusDiv.parent(statusContainer);
    } else {
      statusDiv.html(`${feedbackEmoji} ${recognitionStatus}`);
    }

    let resultDiv = select("#recognitionResult");
    if (!resultDiv) {
      resultDiv = createDiv(`🧠 Result: ${transcript}`).id("recognitionResult");
      resultDiv.addClass("control-group");
      resultDiv.parent(statusContainer);
    } else {
      resultDiv.html(`🧠 Result: ${transcript}`);
    }
  }
}

/**
 * Display data sent to micro:bit
 */
function displaySentData() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let sentDataDiv = select("#sentDataDisplay");
    if (!sentDataDiv) {
      sentDataDiv = createDiv(`📨 Sent Data: ${sentData || "None"}`).id("sentDataDisplay");
      sentDataDiv.addClass("control-group");
      sentDataDiv.parent(statusContainer);
    } else {
      sentDataDiv.html(`📨 Sent Data: ${sentData || "None"}`);
    }
  }
}

/**
 * Handle voice command
 */
function handleVoiceCommand(command) {
  for (const [key, data] of Object.entries(userCommands)) {
    if (command.includes(key)) {
      sendBluetoothData(data[0]);
      sentData = data[0];
      displaySentData();
      console.log(`User command detected: ${key}`);
      return;
    }
  }

  for (const [key, phrases] of Object.entries(voiceCommands)) {
    if (phrases.some((phrase) => command.includes(phrase))) {
      sendBluetoothData(key);
      sentData = key;
      displaySentData();
      console.log(`Command detected: ${key}`);
      return;
    }
  }

  console.log("Unknown command:", command);
}

/**
 * Connect to Bluetooth
 */
async function connectBluetooth() {
  try {
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "BBC micro:bit" }],
      optionalServices: [UART_SERVICE_UUID],
    });

    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

    isConnected = true;
    bluetoothStatus = `Connected to ${bluetoothDevice.name}`;
  } catch (error) {
    console.error("Bluetooth connection failed:", error);
    bluetoothStatus = "Connection Failed";
  }
  updateBluetoothStatus();
}

/**
 * Disconnect Bluetooth
 */
function disconnectBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
    isConnected = false;
    bluetoothStatus = "Disconnected";
    rxCharacteristic = null;
    bluetoothDevice = null;
  } else {
    bluetoothStatus = "Already Disconnected";
  }
  updateBluetoothStatus();
}

/**
 * Update Bluetooth status
 */
function updateBluetoothStatus() {
  const statusElement = select("#bluetoothStatus");
  if (statusElement) {
    statusElement.html(`Status: ${bluetoothStatus}`);
    if (bluetoothStatus.includes("Connected")) {
      statusElement.style("background-color", "#d0f0fd");
      statusElement.style("color", "#FE818D");
    } else {
      statusElement.style("background-color", "#f9f9f9");
      statusElement.style("color", "#FE818D");
    }
  }
}

/**
 * Send Bluetooth data
 */
async function sendBluetoothData(data) {
  if (!rxCharacteristic || !isConnected) {
    console.error("Cannot send data: Device not connected.");
    return;
  }

  try {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(`${data}\n`);
    await rxCharacteristic.writeValue(encodedData);
    console.log("Sent:", data);
  } catch (error) {
    console.error("Error sending data:", error);
  }
}

/**
 * Initialize speech recognition object
 */
function setupVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      transcript = event.results[current][0].transcript.trim();
      recognitionStatus = `Recognized: ${transcript}`;
      handleVoiceCommand(transcript);
      displayRecognitionStatus();
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      recognitionStatus = "An error occurred during speech recognition. Please try again.";
      displayRecognitionStatus();
    };

    recognition.onend = () => {
      recognitionStatus = "Speech recognition stopped.";
      feedbackEmoji = "🤫";
      displayRecognitionStatus();
    };
  } else {
    console.error("This browser does not support speech recognition.");
    const errorDiv = createDiv("This browser does not support speech recognition.").addClass("control-group");
    errorDiv.style("color", "red");
    errorDiv.style("text-align", "center");
    select("#voice-recognition-group").child(errorDiv);
  }
}

function draw() {
  background(220);
}

// Debug: verify all functions run
console.log("Script loaded and running");
