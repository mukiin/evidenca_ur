const express = require("express");
const mysql = require("mysql");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

// Povezava z MySQL
//const db = mysql.createConnection({
///    host: "localhost",
//    user: "root",
 //   password: "",
 //   database: "evidenca_ur"
//});

// KONEKCIJA NA BAZU PODATAKA na serveru
const db = mysql.createConnection({
    host: "web06.g-server.com",
    user: "srednjap_test",
    //password: "4RPhMtBbQX",
    password: "srednjap_test",
    database: "srednjap_test",
    waitForConnections: true,
    //connectionLimit: 10,
    queueLimit: 0
  });

db.connect(err => {
    if (err) {
        console.error("Napaka pri povezavi z bazo:", err);
        return;
    }
    console.log("Povezano z MySQL!");
});

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: "skrivnost", resave: false, saveUninitialized: true }));
app.set("view engine", "ejs");

// PRIJAVA
app.get("/", (req, res) => {
    res.render("login", { message: "" });
});

// Prijava korisnika
app.post("/login", (req, res) => {
    const { uporabnisko_ime, geslo } = req.body;

    db.query("SELECT * FROM zaposleni WHERE uporabnisko_ime = ? AND geslo = ?", [uporabnisko_ime, geslo], (err, results) => {
        if (err) return res.status(500).send('Greška pri prijavi.');

        if (results.length > 0) {
            const user = results[0];

            req.session.user = {
                id: user.id,
                uporabnisko_ime: user.uporabnisko_ime,
                pravice: user.pravice
            };

            res.redirect("/dashboard");
        } else {
            res.status(401).send('Neispravno korisničko ime ili lozinka.');
        }
    });
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    const userId = req.session.user.id; // Id trenutnog korisnika

    db.query("SELECT * FROM projekti", (err, projekti) => {
        if (err) throw err;

        // Ako je korisnik "vodja", vidi sve podatke
        if (req.session.user.pravice === "vodja") {
            db.query(`
                SELECT u.id, u.datum, u.kolicina_ur, p.naziv, z.uporabnisko_ime, z.id as zaposleni_id
                FROM ure u
                JOIN projekti p ON u.projekt_id = p.id
                JOIN zaposleni z ON u.zaposleni_id = z.id`, (err, ure) => {
                if (err) throw err;

                db.query("SELECT id, uporabnisko_ime FROM zaposleni", (err, zaposleni) => {
                    if (err) throw err;

                    res.render("dashboard", { projekti, ure, zaposleni, user: req.session.user, ure_skupno: [] });
                });
            });
        } else {
            // Ako je korisnik "zaposleni", vidi samo svoje podatke
            db.query(`
                SELECT u.id, u.datum, u.kolicina_ur, p.naziv
                FROM ure u
                JOIN projekti p ON u.projekt_id = p.id
                WHERE u.zaposleni_id = ?`, [userId], (err, ure) => {
                if (err) throw err;

                db.query(`
                    SELECT u.zaposleni_id, u.projekt_id, SUM(u.kolicina_ur) as skupno_ur
                    FROM ure u
                    GROUP BY u.zaposleni_id, u.projekt_id
                    HAVING u.zaposleni_id = ?`, [userId], (err, ure_skupno) => {
                    if (err) throw err;

                    res.render("dashboard", {
                        user: req.session.user,
                        projekti: projekti,
                        ure: ure || [],  
                        zaposleni: [],   
                        ure_skupno: ure_skupno || [] 
                    });
                });
            });
        }
    });
});



// VNOS UR
app.post("/dodaj_ure", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    const { projekt_id, datum, kolicina_ur } = req.body;
    db.query("INSERT INTO ure (zaposleni_id, projekt_id, datum, kolicina_ur) VALUES (?, ?, ?, ?)", [req.session.user.id, projekt_id, datum, kolicina_ur], err => {
        if (err) throw err;
        res.redirect("/dashboard");
    });
});



// UREJANJE UR
app.get("/ure-za-projekt/:projekt_id", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    const projekt_id = req.params.projekt_id;
    const userId = req.session.user.id; 
    const pravice = req.session.user.pravice; 

    // Ako je korisnik "vodja", prikazuje sve podatke za projekt, uključujući korisničko ime zaposlenih
    if (req.session.user.pravice === "vodja") {
        db.query(`
            SELECT u.id, u.datum, u.kolicina_ur, p.naziv, z.uporabnisko_ime
            FROM ure u
            JOIN projekti p ON u.projekt_id = p.id
            JOIN zaposleni z ON u.zaposleni_id = z.id
            WHERE u.projekt_id = ?`, [projekt_id], (err, ure) => {
            if (err) throw err;

            res.json({ ure });
        });
    } else {
        // Ako je korisnik "zaposleni", prikazuje samo njegove podatke za projekt, uključujući korisničko ime
        db.query(`
            SELECT u.id, u.datum, u.kolicina_ur, p.naziv, z.uporabnisko_ime
            FROM ure u
            JOIN projekti p ON u.projekt_id = p.id
            JOIN zaposleni z ON u.zaposleni_id = z.id
            WHERE u.projekt_id = ? AND u.zaposleni_id = ?`, [projekt_id, userId], (err, ure) => {
            if (err) throw err;

            res.json({ ure, user: req.session.user, pravice });
        });
    }
});



// IZBRIŠI URE
app.delete("/obrisi_ure/:id", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    const id = req.params.id;

    db.query("SELECT * FROM ure WHERE id = ?", [id], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            const ura = results[0];

            // Provjeriti je li korisnik koji šalje zahtjev vodja ili je autor unosa
            if (req.session.user.pravice === "vodja" || req.session.user.id === ura.zaposleni_id) {
                // Brisanje unosa
                db.query("DELETE FROM ure WHERE id = ?", [id], (err, result) => {
                    if (err) {
                        console.error('Greška pri brisanju:', err);
                        return res.status(500).send('Greška pri brisanju.');
                    }
                    res.status(200).send('Podatak uspješno izbrisan.');
                });
            } else {
                return res.status(403).send('Nemate pravo na brisanje ovog podatka.');
            }
        } else {
            return res.status(404).send('Podatak nije pronađen.');
        }
    });
});

// UREJANJE UR
app.post("/uredi_ure", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/"); 
    }

    const { id, datum, kolicina_ur } = req.body;

    if (!id || !datum || !kolicina_ur) {
        return res.status(400).send('Podaci nisu ispravno poslani.');
    }

    // Provjeriti da li je korisnik "vodja" ili pokušava ažurirati vlastite podatke
    db.query("SELECT * FROM ure WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).send('Greška pri pronalaženju podataka.');

        const ura = results[0];
        // Provjeriti da li je korisnik vodja ili je vlasnik unosa
        if (req.session.user.pravice !== "vodja" && req.session.user.id != ura.zaposleni_id) {
            return res.status(403).send('Nemate pravo na ažuriranje podataka ovog korisnika.');
        }

        // Ažuriraj podatke
        db.query("UPDATE ure SET datum = ?, kolicina_ur = ? WHERE id = ?", [datum, kolicina_ur, id], (err, result) => {
            if (err) {
                console.error('Greška pri ažuriranju:', err);
                return res.status(500).send('Greška pri ažuriranju.');
            }
            res.redirect("/dashboard");  
        });
    });
});


// ODJAVA
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(port, () => {
    console.log(`Server teče na http://localhost:${port}`);
});
