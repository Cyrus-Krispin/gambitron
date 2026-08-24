import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorReporting } from "./lib/clientObservability";

installGlobalErrorReporting();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
