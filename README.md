# Student Portal

A minimal React + Firebase Authentication + Cloud Firestore student CRUD project.

## Run locally

Requirements: Node.js 18 or later.

```bash
npm install
npm run dev
```

Vite prints the local URL, usually http://localhost:5173.

## Connect Firebase later

1. Create a project at https://console.firebase.google.com/
2. Register a Web App in Project settings.
3. Enable Authentication > Sign-in method > Email/Password.
4. Create a Cloud Firestore database.
5. Copy the Web App configuration into `src/firebase.js`. Fill in `apiKey`,
   `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.
6. Publish the contents of `firestore.rules` in Firestore Database > Rules.

The app shows a setup screen while the Firebase configuration is empty. No
Firebase configuration or credentials are included in this repository.

## CRUD fields

- Student name
- Roll number
- Course / class

Records are stored in the Firestore `students` collection.

## Security warning

The included Firestore rules are for a controlled demo only. Any authenticated
account can read, add, edit, or delete all student records. Do not store real
student information or deploy these rules for a real school. Add role-based
authorization before production use.

Firebase web configuration is not a server secret, but Firestore access must
always be protected by security rules.
