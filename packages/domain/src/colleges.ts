import type { College } from "./types.js";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const colleges: College[] = [
  {
    id: "sggs-nanded",
    name: "Shri Guru Gobind Singhji Institute of Engineering and Technology",
    emailDomain: "sggs.ac.in",
    city: "Nanded",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "nit-trichy",
    name: "National Institute of Technology Tiruchirappalli",
    emailDomain: "nitt.edu",
    city: "Tiruchirappalli",
    state: "Tamil Nadu",
    type: "government"
  },
  {
    id: "nit-warangal",
    name: "National Institute of Technology Warangal",
    emailDomain: "nitw.ac.in",
    city: "Warangal",
    state: "Telangana",
    type: "government"
  },
  {
    id: "iit-bombay",
    name: "Indian Institute of Technology Bombay",
    emailDomain: "iitb.ac.in",
    city: "Mumbai",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "iit-delhi",
    name: "Indian Institute of Technology Delhi",
    emailDomain: "iitd.ac.in",
    city: "New Delhi",
    state: "Delhi",
    type: "government"
  },
  {
    id: "iit-kharagpur",
    name: "Indian Institute of Technology Kharagpur",
    emailDomain: "iitkgp.ac.in",
    city: "Kharagpur",
    state: "West Bengal",
    type: "government"
  },
  {
    id: "iiit-hyderabad",
    name: "International Institute of Information Technology Hyderabad",
    emailDomain: "iiit.ac.in",
    city: "Hyderabad",
    state: "Telangana",
    type: "deemed"
  },
  {
    id: "vit-vellore",
    name: "Vellore Institute of Technology",
    emailDomain: "vitstudent.ac.in",
    city: "Vellore",
    state: "Tamil Nadu",
    type: "private"
  },
  {
    id: "bits-pilani",
    name: "BITS Pilani",
    emailDomain: "pilani.bits-pilani.ac.in",
    city: "Pilani",
    state: "Rajasthan",
    type: "deemed"
  },
  {
    id: "coep-tech",
    name: "COEP Technological University",
    emailDomain: "coeptech.ac.in",
    city: "Pune",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "pict-pune",
    name: "Pune Institute of Computer Technology",
    emailDomain: "pict.edu",
    city: "Pune",
    state: "Maharashtra",
    type: "private"
  },
  {
    id: "manit-bhopal",
    name: "Maulana Azad National Institute of Technology Bhopal",
    emailDomain: "manit.ac.in",
    city: "Bhopal",
    state: "Madhya Pradesh",
    type: "government"
  },
  {
    id: "iiitp-pune",
    name: "Indian Institute of Information Technology Pune",
    emailDomain: "cse.iiitp.ac.in",
    city: "Pune",
    state: "Maharashtra",
    type: "government"
  },
  {
    id: "email",
    name: "Google",
    emailDomain: "gmail.com",
    city: "",
    state: "",
    type: "private"
  },
  {
    id: "email",
    name: "Outlook",
    emailDomain: "outlook.com",
    city: "",
    state: "",
    type: "private"
  },
  {
    id: "email",
    name: "Yahoo",
    emailDomain: "yahoo.com",
    city: "",
    state: "",
    type: "private"
  }
];

export const getCollegeByEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  const domain = normalized.includes("@") ? normalized.split("@")[1] : "";
  return colleges.find((college) => college.emailDomain === domain) ?? null;
};

export const isCollegeEmail = (email: string) => getCollegeByEmail(email) !== null;
