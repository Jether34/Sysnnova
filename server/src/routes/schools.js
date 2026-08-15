import express from "express";
import School from "../models/School.js";
import { enabledSubjectsFor } from "../services/subjects.js";

const router = express.Router();

function norm(n = "") {
  return n.toLowerCase().replace(/\s+/g, "").trim();
}

function view(s) {
  return { id: s._id, name: s.name, province: s.province, city: s.city, barangay: s.barangay };
}

// GET /api/schools - schools, optionally filtered by province/city/barangay
router.get("/", async (req, res) => {
  const { province, city, barangay } = req.query;
  const filter = {};
  if (province) filter.province = province;
  if (city) filter.city = city;
  if (barangay) filter.barangay = barangay;
  const schools = await School.find(filter).sort({ province: 1, city: 1, name: 1 });
  return res.json({ schools: schools.map(view) });
});

// GET /api/schools/provinces - distinct provinces (for the address cascade)
router.get("/provinces", async (req, res) => {
  const provinces = (await School.distinct("province")).sort((a, b) => a.localeCompare(b));
  return res.json({ provinces });
});

// GET /api/schools/cities?province=X - distinct cities/municipalities in a province
router.get("/cities", async (req, res) => {
  const { province } = req.query;
  if (!province) return res.status(400).json({ error: "province query param is required." });
  const cities = (await School.distinct("city", { province })).sort((a, b) => a.localeCompare(b));
  return res.json({ cities });
});

// GET /api/schools/barangays?province=X&city=Y - distinct barangays in a city
router.get("/barangays", async (req, res) => {
  const { province, city } = req.query;
  if (!province || !city) return res.status(400).json({ error: "province and city query params are required." });
  const barangays = (await School.distinct("barangay", { province, city })).sort((a, b) => a.localeCompare(b));
  return res.json({ barangays });
});

// GET /api/schools/subjects?schoolId=X&semester=Y&grade=11 - enabled subjects for a school+semester+grade
router.get("/subjects", async (req, res) => {
  const { schoolId, semester, grade } = req.query;
  if (!schoolId || !semester || !grade) {
    return res.status(400).json({ error: "schoolId, semester and grade are required." });
  }
  const enabled = await enabledSubjectsFor({ schoolId, semester, grade });
  return res.json({ subjects: enabled });
});

// POST /api/schools - register a school (name + address)
router.post("/", async (req, res) => {
  const { name, province, city, barangay } = req.body;
  if (!name || !province || !city || !barangay) {
    return res.status(400).json({ error: "School name, province, city/municipality and barangay are all required." });
  }
  const existing = await School.findOne({
    name: name.trim(),
    province: province.trim(),
    city: city.trim(),
    barangay: barangay.trim(),
  });
  if (existing) {
    return res.status(409).json({ error: `"${name.trim()}" in ${province.trim()}, ${city.trim()}, ${barangay.trim()} is already registered.` });
  }
  const school = await School.create({
    name: name.trim(),
    province: province.trim(),
    city: city.trim(),
    barangay: barangay.trim(),
  });
  return res.status(201).json({ school: view(school) });
});

export default router;
