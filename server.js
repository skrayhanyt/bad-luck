// server.js

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs'); // Node.js File System module

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Static File Serving ---
// CSS files from 'css' folder
app.use('/css', express.static(path.join(__dirname, 'css')));
// JavaScript files from 'js' folder
app.use('/js', express.static(path.join(__dirname, 'js')));
// Image files from 'images' folder (ensure this folder exists with your images)
app.use('/images', express.static(path.join(__dirname, 'images')));

// --- HTML Page Serving ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// --- Helper Functions for JSON Data Handling ---
const dataFolderPath = path.join(__dirname, 'data');

const readJsonData = (fileName) => {
    const filePath = path.join(dataFolderPath, `${fileName}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath);
            return JSON.parse(rawData);
        }
        return []; // Return empty array if file doesn't exist
    } catch (error) {
        console.error(`Error reading ${fileName}.json:`, error);
        return []; // Return empty array on error
    }
};

const writeJsonData = (fileName, data) => {
    const filePath = path.join(dataFolderPath, `${fileName}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); // null, 2 for pretty printing
        return true;
    } catch (error) {
        console.error(`Error writing to ${fileName}.json:`, error);
        return false;
    }
};

const generateNewId = (dataArray) => {
    if (!dataArray || dataArray.length === 0) {
        return 1;
    }
    const maxId = dataArray.reduce((max, item) => (item.id > max ? item.id : max), 0);
    return maxId + 1;
};

// --- API Routes ---
const API_PREFIX = '/api';

// Dummy Login Route (INSECURE - FOR DEMO ONLY)
app.post(`${API_PREFIX}/login`, (req, res) => {
    const { username, password } = req.body;
    // In a real app, hash password and compare with stored hash in DB
    // This should match your auth.js logic for client-side test
    if (username === 'admin' && password === 'password') { // Example credentials
        const token = 'fake_jwt_token_for_admin_demo'; // Replace with actual JWT generation
        res.json({ success: true, message: 'Login successful', token: token, username: username });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});


// --- Generic CRUD Route Creator ---
// This function creates CRUD routes for a given data type (entity)
// It assumes the admin panel JS files and forms send/expect specific field names.
// Data mapping might be needed if JSON structure differs significantly.

function createCrudRoutes(entityName, jsonFileName, fieldMapping = {}) {
    const basePath = `${API_PREFIX}/${entityName}`;

    // GET all items
    app.get(basePath, (req, res) => {
        let data = readJsonData(jsonFileName);
        // Apply transformations if needed (e.g., otcEurope logo to logo_url)
        if (entityName === 'otc-europe-jobs' || entityName === 'otc-asia-jobs') {
            data = data.map(item => ({
                id: item.id,
                title: item.title || `Job ${item.id}`, // Add title if missing
                description: item.description,
                logo_url: item.logo || item.logo_url, // Map logo to logo_url
                telegram_user: item.telegramUser || item.telegram_user,
                status: item.status || 'active' // Add status if missing
            }));
        } else if (entityName === 'active-works') {
             data = data.map(item => ({...item, is_active: typeof item.isActive !== 'undefined' ? item.isActive : item.is_active }));
        } else if (entityName === 'instant-works-bd' || entityName === 'how-to-work-articles') {
             data = data.map(item => ({...item, logo_url: item.logo || item.logo_url, full_info: item.fullInfo || item.full_info}));
        }
        res.json(data);
    });

    // GET one item by ID
    app.get(`${basePath}/:id`, (req, res) => {
        const data = readJsonData(jsonFileName);
        const item = data.find(i => i.id == req.params.id); // Use == for loose comparison (string vs number)
        if (item) {
            // Apply same transformations as GET all if needed
             let transformedItem = {...item};
             if (entityName === 'otc-europe-jobs' || entityName === 'otc-asia-jobs') {
                transformedItem = {
                    id: item.id,
                    title: item.title || `Job ${item.id}`,
                    description: item.description,
                    logo_url: item.logo || item.logo_url,
                    telegram_user: item.telegramUser || item.telegram_user,
                    status: item.status || 'active'
                };
            } else if (entityName === 'active-works') {
                 transformedItem.is_active = typeof item.isActive !== 'undefined' ? item.isActive : item.is_active;
            } else if (entityName === 'instant-works-bd' || entityName === 'how-to-work-articles') {
                 transformedItem.logo_url = item.logo || item.logo_url;
                 transformedItem.full_info = item.fullInfo || item.full_info;
            }
            res.json(transformedItem);
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    });

    // POST (create) new item
    app.post(basePath, (req, res) => {
        let data = readJsonData(jsonFileName);
        let newItem = req.body;
        newItem.id = generateNewId(data);

        // Map incoming API fields to JSON storage fields if necessary
        // For example, admin might send 'logo_url', JSON stores 'logo'
        if (entityName === 'otc-europe-jobs' || entityName === 'otc-asia-jobs') {
            if (newItem.logo_url) { newItem.logo = newItem.logo_url; delete newItem.logo_url; }
            if (newItem.telegram_user) { newItem.telegramUser = newItem.telegram_user; delete newItem.telegram_user; }
        } else if (entityName === 'active-works') {
            // 'name' is expected by API, 'country', 'is_active'
            // JSON stores 'name', 'country', 'isActive' (or 'is_active')
            if (typeof newItem.is_active !== 'undefined') {
                 newItem.isActive = newItem.is_active;
                 // delete newItem.is_active; // Keep is_active if admin scripts use that directly for consistency
            }
        } else if (entityName === 'instant-works-bd' || entityName === 'how-to-work-articles') {
            // 'title', 'logo_url', 'full_info'
            if (newItem.logo_url) { newItem.logo = newItem.logo_url; delete newItem.logo_url; }
            if (newItem.full_info) { newItem.fullInfo = newItem.full_info; delete newItem.full_info; }
        }


        data.push(newItem);
        if (writeJsonData(jsonFileName, data)) {
            res.status(201).json({ message: `${jsonFileName} item created successfully`, data: newItem });
        } else {
            res.status(500).json({ message: 'Error saving data' });
        }
    });

    // PUT (update) item by ID
    app.put(`${basePath}/:id`, (req, res) => {
        let data = readJsonData(jsonFileName);
        const itemId = parseInt(req.params.id); // Ensure ID is a number if stored as number
        const itemIndex = data.findIndex(i => i.id === itemId);

        if (itemIndex > -1) {
            let updatedItem = { ...data[itemIndex], ...req.body, id: itemId }; // Preserve ID

            // Map incoming API fields to JSON storage fields
            if (entityName === 'otc-europe-jobs' || entityName === 'otc-asia-jobs') {
                if (updatedItem.logo_url) { updatedItem.logo = updatedItem.logo_url; delete updatedItem.logo_url; }
                if (updatedItem.telegram_user) { updatedItem.telegramUser = updatedItem.telegram_user; delete updatedItem.telegram_user; }
            } else if (entityName === 'active-works') {
                if (typeof updatedItem.is_active !== 'undefined') {
                    updatedItem.isActive = updatedItem.is_active;
                    // delete updatedItem.is_active; // Or keep for consistency
                }
            } else if (entityName === 'instant-works-bd' || entityName === 'how-to-work-articles') {
                if (updatedItem.logo_url) { updatedItem.logo = updatedItem.logo_url; delete updatedItem.logo_url; }
                if (updatedItem.full_info) { updatedItem.fullInfo = updatedItem.full_info; delete updatedItem.full_info; }
            }

            data[itemIndex] = updatedItem;
            if (writeJsonData(jsonFileName, data)) {
                res.json({ message: `${jsonFileName} item updated successfully`, data: updatedItem });
            } else {
                res.status(500).json({ message: 'Error saving data' });
            }
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    });

    // DELETE item by ID
    app.delete(`${basePath}/:id`, (req, res) => {
        let data = readJsonData(jsonFileName);
        const itemId = parseInt(req.params.id);
        const newData = data.filter(i => i.id !== itemId);

        if (data.length !== newData.length) {
            if (writeJsonData(jsonFileName, newData)) {
                res.json({ message: `${jsonFileName} item deleted successfully` });
            } else {
                res.status(500).json({ message: 'Error saving data' });
            }
        } else {
            res.status(404).json({ message: 'Item not found' });
        }
    });
}

// --- Create CRUD routes for each entity ---
// Ensure JSON filenames match exactly (case-sensitive on Linux-based Render servers)
createCrudRoutes('otc-europe-jobs', 'otcEurope');
createCrudRoutes('otc-asia-jobs', 'otcAsia');
createCrudRoutes('active-works', 'activeWork');
createCrudRoutes('instant-works-bd', 'instantWorkBD');
createCrudRoutes('how-to-work-articles', 'howToWork');


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} or on Render service URL`);
    console.warn("WARNING: Data is saved to JSON files. On Render's free tier, these changes will be LOST on service restart/sleep.");
    console.warn("For persistent data, use a database service.");
});