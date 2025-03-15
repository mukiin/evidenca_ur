-- Kreiranje baze
CREATE DATABASE evidenca_ur;

-- Prebacivanje u bazu
USE evidenca_ur;

-- Kreiranje tabele 'zaposleni'
CREATE TABLE zaposleni (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,  -- Primarni ključ i automatski inkrement
    uporabnisko_ime VARCHAR(50) NOT NULL,   -- Korisničko ime, ne može biti NULL
    geslo VARCHAR(50) NOT NULL,             -- Lozinka, ne može biti NULL
    pravice ENUM('zaposleni', 'vodja') NOT NULL -- Pravice korisnika (zaposleni ili vodja)
);

-- Kreiranje tabele 'projekti'
CREATE TABLE projekti (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,  -- Primarni ključ i automatski inkrement
    naziv VARCHAR(100) NOT NULL             -- Naziv projekta, ne može biti NULL
);

-- Kreiranje tabele 'ure'
CREATE TABLE ure (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,  -- Primarni ključ i automatski inkrement
    zaposleni_id INT(11) NOT NULL,          -- ID zaposlenog koji je uneo podatke (strani ključ)
    projekt_id INT(11) NOT NULL,            -- ID projekta na kojem su urađeni sati (strani ključ)
    datum DATE NOT NULL,                    -- Datum kada su radni sati uneseni
    kolicina_ur INT(11) NOT NULL,           -- Količina urađenih sati
    FOREIGN KEY (zaposleni_id) REFERENCES zaposleni(id),  -- Spoljni ključ koji se odnosi na tabelu 'zaposleni'
    FOREIGN KEY (projekt_id) REFERENCES projekti(id)      -- Spoljni ključ koji se odnosi na tabelu 'projekti'
);
