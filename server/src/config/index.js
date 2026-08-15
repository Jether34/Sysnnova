import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/agrimind",
  jwtSecret: process.env.JWT_SECRET || "insecure-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "Sysnnova <no-reply@sysnnova.local>",
  },
};

export const STRANDS = ["STEM", "ABM", "HUMSS", "GAS", "TVL", "Sports", "Arts and Design"];

export const TVL_STRANDS = [
  "Agri-Fishery Arts",
  "Home Economics",
  "Industrial Arts",
  "Information and Communications Technology (ICT)",
];

export const TVL_SPECIALIZATIONS = {
  "Agri-Fishery Arts": [
    "Agricultural Crops Production", "Animal Health Care Management", "Animal Production (Poultry-Chicken)",
    "Animal Production (Large Ruminants)", "Animal Production (Swine)", "Aquaculture",
    "Artificial Insemination (Large Ruminants)", "Artificial Insemination (Swine)", "Fish Capture",
    "Fishing Gear Repair and Maintenance", "Fish-Products Packaging", "Fish Wharf Operation",
    "Food Processing", "Horticulture", "Landscape Installation and Maintenance", "Organic Agriculture",
    "Pest Management", "Rice Machinery Operations", "Rubber Processing", "Rubber Production", "Slaughtering Operations",
  ],
  "Home Economics": [
    "Attractions and Theme Parks Operations", "Barbering", "Bartending", "Beauty/Nail Care",
    "Bread and Pastry Production", "Caregiving", "Commercial Cooking", "Cookery", "Dressmaking",
    "Events Management Services", "Fashion Design (Apparel)", "Food and Beverage Services",
    "Front Office Services", "Hairdressing", "Handicraft", "Housekeeping", "Local Guiding Services",
    "Tailoring", "Tourism Promotion Services", "Travel Services", "Wellness Massage",
  ],
  "Industrial Arts": [
    "Automotive Servicing", "Carpentry", "Construction Painting", "Driving",
    "Electric Power Distribution Line Construction", "Electrical Installation and Maintenance",
    "Electronic Products Assembly and Servicing", "Furniture Making (Finishing)",
    "Instrumentation and Control Servicing", "Machining", "Masonry", "Mechatronics Servicing",
    "Motorcycle/Small Engine Servicing", "Plumbing", "Shielded Metal Arc Welding",
    "Tile Setting", "Transmission Line Installation and Maintenance",
  ],
  "Information and Communications Technology (ICT)": [
    "Animation", "Broadband Installation (Fixed Wireless Systems)",
    "Computer Programming (.Net Technology)", "Computer Programming (Java)",
    "Computer Programming (Oracle Database)", "Computer Systems Servicing",
    "Contact Center Services", "Illustration", "Medical Transcription",
    "Technical Drafting", "Telecom OSP and Subscriber Line Installation",
    "Telecom OSP Installation (Fiber Optic Cable)",
  ],
};

export const GRADE_LEVELS = ["7", "8", "9", "10", "11", "12"];

export const SHS_GRADE_LEVELS = ["11", "12"];

export const SEMESTERS = [
  "1st Semester, 1st Quarter",
  "1st Semester, 2nd Quarter",
  "2nd Semester, 3rd Quarter",
  "2nd Semester, 4th Quarter",
];

export const BLOCKS = Array.from({ length: 20 }, (_, i) => String(i + 1));

export const JHS_SUBJECTS = [
  "Araling Panlipunan",
  "English",
  "Filipino",
  "Mathematics",
  "Science",
  "Edukasyon sa Pagpapakatao",
  "MAPEH",
  "Technology and Livelihood Education",
];

export const SHS_SUBJECTS = [
  // Senior High School - core
  "General Mathematics",
  "Statistics and Probability",
  "Oral Communication in Context",
  "Reading and Writing Skills",
  "Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino",
  "Pagbasa at Pagsusuri ng Iba't Ibang Teksto Tungo sa Pananaliksik",
  "21st Century Literature from the Philippines and the World",
  "Physical Science",
  "Earth and Life Science",
  "Empowerment Technologies",
  "Understanding Culture, Society and Politics",
  "Personal Development",
  "Media and Information Literacy",
  // Senior High School - STEM
  "General Physics",
  "General Chemistry",
  "General Biology",
  "Pre-Calculus",
  "Basic Calculus",
  // Senior High School - applied / specialized
  "English for Academic and Professional Purposes",
  "Practical Research 1",
  "Practical Research 2",
  "Inquiries, Investigations and Immersion",
  "Entrepreneurship",
];

export const SUBJECTS = [...JHS_SUBJECTS, ...SHS_SUBJECTS];

export function isShsGrade(grade) {
  return SHS_GRADE_LEVELS.includes(String(grade));
}

export function subjectsFor(grade) {
  return isShsGrade(grade) ? SHS_SUBJECTS : JHS_SUBJECTS;
}
