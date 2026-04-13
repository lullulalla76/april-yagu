import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDaxWUt14jLEoEMB6cKlGche52B7yAKOow",
  authDomain: "april-yagu.firebaseapp.com",
  projectId: "april-yagu",
  storageBucket: "april-yagu.firebasestorage.app",
  messagingSenderId: "72649665359",
  appId: "1:72649665359:web:958fcc0a2c39aded7bb33a",
  measurementId: "G-4WDH71ZC85"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // 이제 이 db를 빌려다가 채팅을 저장할 거예요!