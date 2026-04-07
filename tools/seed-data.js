// tools/seed-data.js
const bcrypt = require('bcrypt');
const { db, now } = require('../src/db');

const universityStructure = [
  {
    school: "School of Computer Science and Engineering",
    departments: [
      {
        name: "Department of Core Computer Science",
        faculty: [
          { name: "Dr. Alan Turing", email: "turing@examvault.local" },
          { name: "Dr. Grace Hopper", email: "hopper@examvault.local" }
        ],
        subjects: [
          { code: "CSE101", name: "Data Structures and Algorithms", assignedTo: ["turing@examvault.local"] },
          { code: "CSE102", name: "Operating Systems", assignedTo: ["hopper@examvault.local"] },
          { code: "CSE103", name: "Theory of Computation", assignedTo: ["turing@examvault.local", "hopper@examvault.local"] }
        ]
      },
      {
        name: "Department of Artificial Intelligence & Machine Learning",
        faculty: [{ name: "Dr. Geoffrey Hinton", email: "hinton@examvault.local" }],
        subjects: [
          { code: "AIM201", name: "Neural Networks and Deep Learning", assignedTo: ["hinton@examvault.local"] },
          { code: "AIM202", name: "Natural Language Processing", assignedTo: ["hinton@examvault.local"] }
        ]
      },
      {
        name: "Department of Cyber Security & Digital Forensics",
        faculty: [{ name: "Dr. Bruce Schneier", email: "schneier@examvault.local" }],
        subjects: [
          { code: "CYS301", name: "Applied Cryptography", assignedTo: ["schneier@examvault.local"] },
          { code: "CYS302", name: "Network Security and Ethical Hacking", assignedTo: ["schneier@examvault.local"] }
        ]
      },
      {
        name: "Department of Information Technology",
        faculty: [{ name: "Dr. Tim Berners-Lee", email: "bernerslee@examvault.local" }],
        subjects: [
          { code: "ITE101", name: "Web Technologies", assignedTo: ["bernerslee@examvault.local"] },
          { code: "ITE102", name: "Cloud Computing Architecture", assignedTo: ["bernerslee@examvault.local"] }
        ]
      }
    ]
  },
  {
    school: "School of Electrical and Electronics Engineering",
    departments: [
      {
        name: "Department of Electronics and Communication (ECE)",
        faculty: [{ name: "Dr. Claude Shannon", email: "shannon@examvault.local" }],
        subjects: [
          { code: "ECE201", name: "Digital Signal Processing", assignedTo: ["shannon@examvault.local"] },
          { code: "ECE202", name: "VLSI Design", assignedTo: ["shannon@examvault.local"] }
        ]
      },
      {
        name: "Department of Electrical and Electronics (EEE)",
        faculty: [{ name: "Dr. Nikola Tesla", email: "tesla@examvault.local" }],
        subjects: [
          { code: "EEE201", name: "Power System Analysis", assignedTo: ["tesla@examvault.local"] },
          { code: "EEE202", name: "Control Systems Engineering", assignedTo: ["tesla@examvault.local"] }
        ]
      },
      {
        name: "Department of Embedded Systems & IoT",
        faculty: [{ name: "Dr. Kevin Ashton", email: "ashton@examvault.local" }],
        subjects: [
          { code: "IOT301", name: "Microcontrollers and Interfacing", assignedTo: ["ashton@examvault.local"] },
          { code: "IOT302", name: "Wireless Sensor Networks", assignedTo: ["ashton@examvault.local"] }
        ]
      }
    ]
  },
  {
    school: "School of Mechanical Engineering",
    departments: [
      {
        name: "Department of Core Mechanical",
        faculty: [{ name: "Dr. Henry Ford", email: "ford@examvault.local" }],
        subjects: [
          { code: "MEC101", name: "Engineering Thermodynamics", assignedTo: ["ford@examvault.local"] },
          { code: "MEC102", name: "Fluid Mechanics and Machinery", assignedTo: ["ford@examvault.local"] }
        ]
      },
      {
        name: "Department of Automotive Engineering",
        faculty: [{ name: "Dr. Karl Benz", email: "benz@examvault.local" }],
        subjects: [
          { code: "AUT201", name: "Internal Combustion Engines", assignedTo: ["benz@examvault.local"] },
          { code: "AUT202", name: "Hybrid and Electric Vehicles", assignedTo: ["benz@examvault.local"] }
        ]
      },
      {
        name: "Department of Robotics & Automation",
        faculty: [{ name: "Dr. Joseph Engelberger", email: "engelberger@examvault.local" }],
        subjects: [
          { code: "ROB301", name: "Industrial Robotics", assignedTo: ["engelberger@examvault.local"] },
          { code: "ROB302", name: "Mechatronics and Automation", assignedTo: ["engelberger@examvault.local"] }
        ]
      }
    ]
  },
  {
    school: "School of Advanced Sciences",
    departments: [
      {
        name: "Department of Mathematics",
        faculty: [{ name: "Dr. Carl Gauss", email: "gauss@examvault.local" }],
        subjects: [
          { code: "MAT101", name: "Calculus and Differential Equations", assignedTo: ["gauss@examvault.local"] },
          { code: "MAT102", name: "Discrete Mathematical Structures", assignedTo: ["gauss@examvault.local"] },
          { code: "MAT103", name: "Linear Algebra", assignedTo: ["gauss@examvault.local"] }
        ]
      },
      {
        name: "Department of Physics",
        faculty: [{ name: "Dr. Albert Einstein", email: "einstein@examvault.local" }],
        subjects: [
          { code: "PHY101", name: "Engineering Electromagnetics", assignedTo: ["einstein@examvault.local"] },
          { code: "PHY102", name: "Quantum Physics", assignedTo: ["einstein@examvault.local"] }
        ]
      },
      {
        name: "Department of Chemistry",
        faculty: [{ name: "Dr. Marie Curie", email: "curie@examvault.local" }],
        subjects: [
          { code: "CHM101", name: "Environmental Chemistry", assignedTo: ["curie@examvault.local"] },
          { code: "CHM102", name: "Science of Engineering Materials", assignedTo: ["curie@examvault.local"] }
        ]
      }
    ]
  }
];

function seedDatabase() {
  console.log('🌱 Starting Comprehensive Seeding (Departments, Subjects, & Faculty)...');
  
  // Get the default Admin ID to use as the "approved_by" user
  const adminRow = db.prepare(`SELECT id FROM Users WHERE role = 'admin' LIMIT 1`).get();
  const adminId = adminRow ? adminRow.id : null;
  const facultyPasswordHash = bcrypt.hashSync('Faculty@123', 12);
  const timestamp = now();

  db.exec('BEGIN TRANSACTION;');

  try {
    const insertDept = db.prepare(`INSERT INTO Departments (name, created_at, parent_department_id) VALUES (?, ?, ?)`);
    const insertSubject = db.prepare(`INSERT INTO Subjects (code, name, department_id, created_at) VALUES (?, ?, ?, ?)`);
    const insertUser = db.prepare(`
      INSERT INTO Users (name, email, password_hash, role, department_id, status, approved_at, approved_by, created_at)
      VALUES (?, ?, ?, 'faculty', ?, 'active', ?, ?, ?)
    `);
    const assignSubject = db.prepare(`
      INSERT INTO FacultySubjectAssignments (user_id, subject_id, approved_by, approved_at, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `);

    let stats = { schools: 0, depts: 0, subjects: 0, faculty: 0, assignments: 0 };

    for (const schoolNode of universityStructure) {
      const schoolId = Number(insertDept.run(schoolNode.school, timestamp, null).lastInsertRowid);
      stats.schools++;

      for (const deptNode of schoolNode.departments) {
        const deptId = Number(insertDept.run(deptNode.name, timestamp, schoolId).lastInsertRowid);
        stats.depts++;

        const facultyIdMap = {};

        // Insert Faculty members for this department
        for (const faculty of deptNode.faculty) {
          const userId = Number(insertUser.run(
            faculty.name, faculty.email, facultyPasswordHash, deptId, timestamp, adminId, timestamp
          ).lastInsertRowid);
          facultyIdMap[faculty.email] = userId;
          stats.faculty++;
        }

        // Insert Subjects and map them to the created Faculty
        for (const subject of deptNode.subjects) {
          const subjectId = Number(insertSubject.run(subject.code, subject.name, deptId, timestamp).lastInsertRowid);
          stats.subjects++;

          for (const email of subject.assignedTo) {
            const userId = facultyIdMap[email];
            if (userId) {
              assignSubject.run(userId, subjectId, adminId, timestamp, timestamp);
              stats.assignments++;
            }
          }
        }
      }
    }

    db.exec('COMMIT;');
    console.log('✅ Seeding Complete!');
    console.log(`📊 Inserted: ${stats.schools} Schools, ${stats.depts} Departments`);
    console.log(`👩‍🏫 Inserted: ${stats.faculty} Faculty Members, ${stats.subjects} Subjects (${stats.assignments} Assignments)`);
    console.log('\n🔐 Default Faculty Password: Faculty@123');
    
  } catch (error) {
    db.exec('ROLLBACK;');
    console.error('❌ Seeding Failed. Rolling back changes.');
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.error('Error: Data already exists. Run `npm run reset:data` first.');
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

seedDatabase();