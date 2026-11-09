import ReactDOM from "react-dom/client";
import { Home } from "./pages/Home";
import { Draw } from "./pages/Draw";
import { Display } from "./pages/Display";
import "./styles/main.css";
const path = location.pathname;
ReactDOM.createRoot(document.getElementById("root")!).render(
  path === "/draw" ? <Draw /> : path === "/display" ? <Display /> : <Home />,
);
