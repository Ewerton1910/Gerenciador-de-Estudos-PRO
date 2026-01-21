const CLOUD_NAME = "dgagemtqg";
const UPLOAD_PRESET = "Gerenciador_Estudos";
const firebaseConfig = {
    apiKey: "AIzaSyDtziafcFDXZd9sGndXleqijouEIcqBeIk",
    authDomain: "gerenciador-de-estudos-9544b.firebaseapp.com",
    databaseURL: "https://gerenciador-de-estudos-9544b-default-rtdb.firebaseio.com",
    projectId: "gerenciador-de-estudos-9544b",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

// CORREÇÃO 1: Garantir estrutura inicial completa
let studyData = { folders: [], settings: { alarmInterval: 86400000, alarmActive: true } };
let currentDay = new Date().getDay();
let mode = "daily";
let activeFolderId = null;
let activeFile = null;
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        // CORREÇÃO 2: Garantir que 'folders' sempre seja um Array, mesmo se o Firebase retornar vazio
        studyData = data;
        if (!studyData.folders) studyData.folders = []; 
        if (!studyData.settings) studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        
        const intervalEl = document.getElementById("alarmInterval");
        const activeEl = document.getElementById("alarmActive");
        if(intervalEl) intervalEl.value = studyData.settings.alarmInterval;
        if(activeEl) activeEl.checked = studyData.settings.alarmActive;
    }
    render();
});

// ... (Restante das suas funções handleUpload, openPDF, etc permanecem IDÊNTICAS)
