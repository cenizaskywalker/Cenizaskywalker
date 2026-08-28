import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Portfolio } from "./pages/Portfolio";
import { ProjectPage } from "./pages/ProjectPage";
import { Admin } from "./pages/Admin";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><Routes><Route path="/" element={<Portfolio/>}/><Route path="/work/:slug" element={<ProjectPage/>}/><Route path="/admin/*" element={<Admin/>}/></Routes></BrowserRouter></StrictMode>);
