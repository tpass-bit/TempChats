// Correct WEB configuration for Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBPF1VE82Y3VkZe6IibjqKxBC-XHjM_Wco",
  authDomain: "chat-2024-ff149.firebaseapp.com",
  databaseURL: "https://chat-2024-ff149-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-2024-ff149",
  storageBucket: "chat-2024-ff149.appspot.com",
  messagingSenderId: "146349109253",
  appId: "1:146349109253:web:e593afbf0584762519ac6c" // Changed from android: to web:
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Add error handling
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
}
