// Bluetooth UUIDs for micro:bit UART service
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "Disconnected";

let recognition;
let transcript = ""; // 음성 인식 결과
let recognitionStatus = "🕹️ 음성 인식을 시작하려면 버튼을 누르세요."; // 상태 안내 문구
let feedbackEmoji = ""; // 이모지 피드백
let sentData = ""; // 마이크로비트로 전송된 데이터

// 음성 명령과 전송 데이터 매핑
const voiceCommands = {
  forward: ["전진", "앞으로", "직진", "출발"],
  backward: ["뒤로", "후진"],
  stop: ["멈춰", "정지", "그만"],
  left: ["좌회전", "왼쪽", "좌측", "좌로", "반시계"],
  right: ["우회전", "오른쪽", "우측", "으로", "시계"],
  ring: ["사이렌", "소리", "부저", "경보음"]
};

let userCommands = {}; // 사용자가 추가한 명령어를 저장하는 객체

function setup() {
  console.log("Setup function called"); // 디버깅용 로그
  const canvas = createCanvas(30, 30);
  canvas.parent("p5-container");

  // STEP1: 블루투스 연결
  createBluetoothUI();

  // STEP2: 음성 인식 데이터 표
  createCommandTable();

  // STEP3: 사용자 명령어 추가 UI
  createUserCommandUI();

  // STEP4: 음성 인식 제어
  createVoiceRecognitionUI();

  // 음성 인식 객체 초기화
  setupVoiceRecognition();
}

/**
 * STEP1: 블루투스 연결 UI 생성
 */
function createBluetoothUI() {
  console.log("Creating Bluetooth UI"); // 디버깅용 로그
  const statusElement = select("#bluetoothStatus");
  if (statusElement) {
    statusElement.html(`상태: ${bluetoothStatus}`);
  }

  const buttonContainer = select("#bluetooth-control-buttons");
  if (buttonContainer) {
    const connectButton = createButton("🔗 블루투스 연결").addClass("start-button");
    connectButton.mousePressed(connectBluetooth);
    buttonContainer.child(connectButton);

    const disconnectButton = createButton("❌ 블루투스 연결 해제").addClass("stop-button");
    disconnectButton.mousePressed(disconnectBluetooth);
    buttonContainer.child(disconnectButton);
  }
}

/**
 * STEP2: 음성 인식 데이터 표 생성
 */
function createCommandTable() {
  console.log("Creating Command Table"); // 디버깅용 로그
  const tableContainer = select("#command-table-container");
  if (tableContainer) {
    const table = createElement("table");
    tableContainer.child(table);

    const header = createElement("tr");
    header.child(createElement("th", "음성 명령"));
    header.child(createElement("th", "전송 데이터"));
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
 * STEP3: 사용자 명령어 추가 UI
 */
function createUserCommandUI() {
  console.log("Creating User Command UI"); // 디버깅용 로그
  const inputContainer = select("#user-command-ui");
  if (inputContainer) {
    const commandInput = createInput().attribute("placeholder", "새로운 음성 명령");
    inputContainer.child(commandInput);

    const dataInput = createInput().attribute("placeholder", "명령에 맞는 전송 데이터");
    inputContainer.child(dataInput);

    const addButton = createButton("➕ 명령어 추가").addClass("start-button");
    addButton.mousePressed(() => {
      const command = commandInput.value().trim();
      const data = dataInput.value().trim();

      if (command && data) {
        userCommands[command] = [data];
        updateCommandTable();
        commandInput.value("");
        dataInput.value("");
      } else {
        alert("명령어와 전송 데이터를 모두 입력해주세요.");
      }
    });
    inputContainer.child(addButton);

    updateCommandTable();
  }
}

// 명령어 테이블 업데이트
function updateCommandTable() {
  const table = select("table");
  if (table) {
    table.html("");
    const header = createElement("tr");
    header.child(createElement("th", "음성 명령"));
    header.child(createElement("th", "전송 데이터"));
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
 * STEP4: 음성 인식 제어 UI 생성
 */
function createVoiceRecognitionUI() {
  console.log("Creating Voice Recognition UI"); // 디버깅용 로그
  const buttonContainer = select("#voice-recognition-ui");
  if (buttonContainer) {
    const startButton = createButton("🟢 음성 인식 시작").addClass("start-button");
    startButton.mousePressed(() => {
      if (!isConnected) {
        alert("블루투스가 연결되어 있지 않습니다. 블루투스를 연결하세요.");
      } else {
        recognition.start();
        recognitionStatus = "음성 인식을 시작합니다. 말해보세요!";
        feedbackEmoji = "🎤";
        displayRecognitionStatus();
      }
    });
    buttonContainer.child(startButton);

    const stopButton = createButton("🔴 음성 인식 중지").addClass("stop-button");
    stopButton.mousePressed(() => {
      recognition.stop();
      recognitionStatus = "음성 인식을 중지합니다.";
      feedbackEmoji = "🤫";
      displayRecognitionStatus();
    });
    buttonContainer.child(stopButton);

    displayRecognitionStatus();
    displaySentData();
  }
}

/**
 * 음성 인식 상태와 결과를 화면에 표시
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
      resultDiv = createDiv(`🧠 결과: ${transcript}`).id("recognitionResult");
      resultDiv.addClass("control-group");
      resultDiv.parent(statusContainer);
    } else {
      resultDiv.html(`🧠 결과: ${transcript}`);
    }
  }
}

/**
 * 마이크로비트 전송 데이터를 화면에 표시
 */
function displaySentData() {
  const statusContainer = select("#status-container");
  if (statusContainer) {
    let sentDataDiv = select("#sentDataDisplay");
    if (!sentDataDiv) {
      sentDataDiv = createDiv(`📨 전송 데이터: ${sentData || "없음"}`).id("sentDataDisplay");
      sentDataDiv.addClass("control-group");
      sentDataDiv.parent(statusContainer);
    } else {
      sentDataDiv.html(`📨 전송 데이터: ${sentData || "없음"}`);
    }
  }
}

/**
 * 음성 명령 처리
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
 * 블루투스 연결
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
 * 블루투스 연결 해제
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
 * 블루투스 상태 업데이트
 */
function updateBluetoothStatus() {
  const statusElement = select("#bluetoothStatus");
  if (statusElement) {
    statusElement.html(`상태: ${bluetoothStatus}`);
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
 * 블루투스 데이터 전송
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
 * 음성 인식 객체 초기화
 */
function setupVoiceRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      transcript = event.results[current][0].transcript.trim();
      recognitionStatus = `인식된 결과: ${transcript}`;
      handleVoiceCommand(transcript);
      displayRecognitionStatus();
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      recognitionStatus = "음성 인식 중 오류가 발생했습니다. 다시 시도하세요.";
      displayRecognitionStatus();
    };

    recognition.onend = () => {
      recognitionStatus = "음성 인식이 중지되었습니다.";
      feedbackEmoji = "🤫";
      displayRecognitionStatus();
    };
  } else {
    console.error("이 브라우저는 음성 인식을 지원하지 않습니다.");
    const errorDiv = createDiv("이 브라우저는 음성 인식을 지원하지 않습니다.").addClass("control-group");
    errorDiv.style("color", "red");
    errorDiv.style("text-align", "center");
    select("#voice-recognition-group").child(errorDiv);
  }
}

function draw() {
  background(220);
}

// 디버깅용: 모든 함수가 호출되는지 확인
console.log("Script loaded and running");