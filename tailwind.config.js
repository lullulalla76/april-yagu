/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}", // 👈 이 줄이 내 코드의 위치를 정확히 가리켜야 해요!
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }