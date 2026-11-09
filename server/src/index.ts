import { createApp } from "./app.js";
const { http } = createApp();
http.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("슝슝 그림 놀이터 · port " + (process.env.PORT || 3000)),
);
