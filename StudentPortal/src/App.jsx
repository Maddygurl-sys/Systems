import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc
} from "firebase/firestore";
import { auth, db, firebaseReady } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [students, setStudents] = useState([]);
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [course, setCourse] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && db) loadStudents();
    else setStudents([]);
  }, [user]);

  async function loadStudents() {
    try {
      const snapshot = await getDocs(collection(db, "students"));
      setStudents(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      })));
    } catch (error) {
      setMessage(`Could not load students: ${error.message}`);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveStudent(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const student = {
      name: name.trim(),
      roll: roll.trim(),
      course: course.trim()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "students", editingId), student);
        setMessage("Student details updated.");
      } else {
        await addDoc(collection(db, "students"), student);
        setMessage("Student added.");
      }
      clearForm();
      await loadStudents();
    } catch (error) {
      setMessage(`Could not save student: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(student) {
    setEditingId(student.id);
    setName(student.name || "");
    setRoll(student.roll || "");
    setCourse(student.course || "");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setRoll("");
    setCourse("");
  }

  async function removeStudent(id) {
    if (!window.confirm("Delete this student record?")) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteDoc(doc(db, "students", id));
      setMessage("Student deleted.");
      await loadStudents();
      if (editingId === id) clearForm();
    } catch (error) {
      setMessage(`Could not delete student: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseReady) {
    return (
      <main className="page">
        <section className="setup-card">
          <div className="brand-mark">SP</div>
          <p className="eyebrow">READY TO CONNECT</p>
          <h1>Student Portal</h1>
          <p className="muted">
            The application is ready. Add your Firebase Web App configuration
            to <code>src/firebase.js</code> when you want to connect it.
          </p>
          <div className="setup-steps">
            <p><strong>1.</strong> Create a project in Firebase Console.</p>
            <p><strong>2.</strong> Add a Web App and copy its configuration.</p>
            <p><strong>3.</strong> Enable Email/Password Authentication and create Firestore.</p>
            <p><strong>4.</strong> Paste the configuration values into <code>src/firebase.js</code>.</p>
          </div>
          <p className="note">
            No Firebase credentials are included, so login and data storage
            remain disabled until you add your configuration.
          </p>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return <main className="page"><p className="loading">Loading Student Portal...</p></main>;
  }

  if (!user) {
    return (
      <main className="page">
        <section className="auth-card">
          <div className="brand-mark">SP</div>
          <p className="eyebrow">STUDENT MANAGEMENT</p>
          <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="muted">
            {isRegister ? "Register to open the student portal." : "Sign in to manage student records."}
          </p>
          <form onSubmit={handleAuth} className="form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="primary full" disabled={busy}>
              {busy ? "Please wait..." : isRegister ? "Register" : "Login"}
            </button>
          </form>
          {message && <p className="message error">{message}</p>}
          <p className="switch-auth">
            {isRegister ? "Already have an account?" : "New to the portal?"}{" "}
            <button className="text-button" onClick={() => {
              setIsRegister(!isRegister);
              setMessage("");
            }}>
              {isRegister ? "Login" : "Register"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark small">SP</div>
          <div>
            <strong>Student Portal</strong>
            <span>Student records management</span>
          </div>
        </div>
        <div className="account">
          <span className="user-email">{user.email}</span>
          <button className="secondary" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">DASHBOARD</p>
          <h1>Student records</h1>
          <p className="muted">Add, view, edit, and remove student details.</p>
        </div>
        <div className="count-card">
          <span>Total students</span>
          <strong>{students.length}</strong>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="content-grid">
        <section className="panel">
          <h2>{editingId ? "Edit student" : "Add a student"}</h2>
          <form onSubmit={saveStudent} className="form">
            <label htmlFor="student-name">Full name</label>
            <input
              id="student-name"
              placeholder="Student name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <label htmlFor="roll-number">Roll number</label>
            <input
              id="roll-number"
              placeholder="e.g. 23IT001"
              value={roll}
              onChange={(event) => setRoll(event.target.value)}
              required
            />
            <label htmlFor="course">Course / Class</label>
            <input
              id="course"
              placeholder="e.g. BTech IT"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              required
            />
            <button className="primary full" disabled={busy}>
              {busy ? "Saving..." : editingId ? "Update student" : "Add student"}
            </button>
            {editingId && (
              <button type="button" className="secondary full" onClick={clearForm}>
                Cancel edit
              </button>
            )}
          </form>
        </section>

        <section className="panel records-panel">
          <div className="panel-heading">
            <div>
              <h2>All students</h2>
              <p className="muted">{students.length} record(s)</p>
            </div>
            <button className="secondary" onClick={loadStudents}>Refresh</button>
          </div>
          {students.length === 0 ? (
            <div className="empty-state">
              <strong>No student records yet</strong>
              <p className="muted">Use the form to add your first student.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Roll number</th><th>Course</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td data-label="Name">{student.name}</td>
                      <td data-label="Roll number">{student.roll}</td>
                      <td data-label="Course">{student.course}</td>
                      <td data-label="Actions" className="actions">
                        <button className="small-button" onClick={() => startEdit(student)}>Edit</button>
                        <button className="small-button danger" onClick={() => removeStudent(student.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
      <footer>Student Portal · React + Firebase</footer>
    </main>
  );
}
