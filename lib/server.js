const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const path = require('path');
const zxpProvider = require('zxp-signer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const jsxbin = require('jsxbin');
const os = require('os');
const crypto = require('crypto');

const app = express();
const port = 3050;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Helper function to wrap exec in a Promise for cleaner async/await usage
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
            if (error) {
                // Reject with all output for detailed error reporting
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

// --- HELPER FUNCTION TO CLEAN QUOTES FROM PATHS ---
const cleanPathQuotes = (p) => {
    if (typeof p === 'string') {
        // Remove leading and trailing double quotes (")
        return p.replace(/^"|"$/g, '').trim();
    }
    return p;
};
// --------------------------------------------------

app.get('/', (req, res) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZXP Signer Tool</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;600&display=swap');

            body {
                font-family: 'Inter', sans-serif;
                padding: 1rem;
                background-color: #1d1d1d;
                color: #d0d0d0;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                min-height: 100vh;
            }

            .main-content {
                display: flex;
                gap: 24px;
                width: 100%;
                max-width: 1000px;
                margin-top: 2rem;
                flex-wrap: wrap;
                align-items: flex-start;
            }

            .container, .panel {
                background-color: #3b3b3b;
                border-radius: 8px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .container {
                flex: 1 1 500px;
            }

            .panel {
                flex: 1 1 350px;
                min-height: 400px;
            }
            
            .title {
                font-size: 1.5rem;
                font-weight: 700;
                color: #d0d0d0;
                text-align: center;
                margin-bottom: 8px;
            }

            .form-group {
                width: 100%;
            }

            label {
                display: block;
                margin-bottom: 8px;
                font-size: 0.875rem;
                color: #999;
            }

            input[type="text"], input[type="password"] {
                width: 100%;
                padding: 10px;
                background-color: #4b4b4b;
                border: 1px solid #555;
                color: #d0d0d0;
                border-radius: 4px;
                box-sizing: border-box;
            }

            input[type="text"]:focus, input[type="password"] {
                outline: none;
                border-color: #0078d7;
                box-shadow: 0 0 0 1px #0078d7;
            }
            
            .button {
                width: 100%;
                padding: 12px;
                background-color: #0078d7;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                transition: background-color 0.2s ease-in-out;
                margin-top: 8px;
            }

            .button:hover {
                background-color: #005a9e;
            }
            
            .log-box {
                padding: 12px;
                background-color: #4b4b4b;
                border: 1px solid #555;
                color: #d0d0d0;
                border-radius: 4px;
                font-family: monospace;
                white-space: pre-wrap;
                word-wrap: break-word;
                min-height: 2em;
                margin-top: 8px;
                height: 100px;
                overflow-y: auto;
            }
            
            /* --- Saved Settings Card Styles --- */
            .saved-settings-card {
                background-color: #4b4b4b;
                padding: 12px;
                border-radius: 4px;
                border: 1px solid #555;
                transition: background-color 0.2s ease-in-out;
                
                /* Layout for content + delete button */
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }

            .saved-settings-card:hover {
                background-color: #555;
            }
            
            .card-content-area {
                flex-grow: 1;
                cursor: pointer; /* Indicate double-click is possible here */
            }

            .saved-settings-card h3 {
                font-size: 1rem;
                font-weight: 700;
                margin: 0 0 4px 0;
            }

            .saved-settings-card p {
                font-size: 0.875rem;
                margin: 0;
                color: #aaa;
            }

            .delete-btn {
                background: none;
                border: none;
                color: #aaa;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0 5px;
                line-height: 1;
                font-weight: 600; /* Make the 'x' bolder */
            }

            .delete-btn:hover {
                color: #f87171; /* Red color on hover */
            }
            /* --- End Card Styles --- */


            .panel-header {
                font-size: 1.2rem;
                font-weight: 700;
                color: #d0d0d0;
                text-align: center;
                margin-bottom: 8px;
            }

            /* Custom checkbox styling for better visibility */
            .checkbox-group {
                display: flex;
                align-items: center;
                margin-top: 8px;
                margin-bottom: 8px;
            }
            .checkbox-group input[type="checkbox"] {
                width: 16px;
                height: 16px;
                margin-right: 10px;
                background-color: #4b4b4b;
                border: 1px solid #555;
            }
            
        </style>
    </head>
    <body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
        <div class="main-content">
            <div class="container">
                <h1 class="title">ZXP Signer</h1>
                <p style="text-align: center; font-size: 0.875rem; color: #999;">A local tool to sign and package your Adobe extensions.</p>
                
                <form id="signerForm">
                    <div class="form-group">
                        <label for="inputPath">Extension Folder Path</label>
                        <input type="text" id="inputPath" name="inputPath" required
                               placeholder="e.g., /Users/yourname/Documents/my-extension">
                    </div>
                    <div class="form-group">
                        <label for="outputPath">Output ZXP File Path</label>
                        <input type="text" id="outputPath" name="outputPath" required
                               placeholder="e.g., /Users/yourname/Documents/my-extension.zxp">
                    </div>
                    
                    <h2 style="font-size: 1rem; font-weight: 700; color: #d0d0d0; margin-top: 16px;">Create Certificate</h2>
                    <div class="form-group">
                        <label for="certPath">Certificate Output Path</label>
                        <input type="text" id="certPath" name="certPath" required
                               placeholder="e.g., /Users/yourname/Documents/my-cert.p12">
                    </div>
                    <div class="form-group">
                        <label for="certPassword">Certificate Password</label>
                        <input type="password" id="certPassword" name="certPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="certCountry">Country Code (e.g., US)</label>
                        <input type="text" id="certCountry" name="certCountry" required>
                    </div>
                    <div class="form-group">
                        <label for="certState">State/Province</label>
                        <input type="text" id="certState" name="certState" required>
                    </div>
                    <div class="form-group">
                        <label for="certOrg">Organization</label>
                        <input type="text" id="certOrg" name="certOrg" required>
                    </div>
                    <div class="form-group">
                        <label for="certName">Common Name (Your Name)</label>
                        <input type="text" id="certName" name="certName" required>
                    </div>
                    <div class="form-group">
                        <label for="timestampUrl">Timestamp Server URL</label>
                        <input type="text" id="timestampUrl" name="timestampUrl" 
                               value="http://timestamp.digicert.com"
                               placeholder="e.g., http://timestamp.digicert.com">
                    </div>

                    <div class="checkbox-group">
                        <label for="obfuscateJsx" style="color: #d0d0d0; margin-bottom: 0; cursor: pointer;">
                            <input type="checkbox" id="obfuscateJsx" name="obfuscateJsx" />
                            **Compile to JSXBIN** (Converts JSX/JS to binary ExtendScript)
                        </label>
                    </div>

                    <button type="submit" class="button">
                        Create Cert & Sign
                    </button>
                </form>
                
                <div class="log-box" id="logBox">
                    <p>Welcome to the ZXP Signer. Log messages will appear here.</p>
                </div>
            </div>

            <div class="panel">
                <h2 class="panel-header">Saved Settings</h2>
                <div id="savedSettingsPanel" style="display: flex; flex-direction: column; gap: 8px;">
                    <p style="text-align: center; color: #999;">Double-click a card to load settings.</p>
                </div>
            </div>
        </div>

        <script>
            function logMessage(message, color) {
                const logBox = document.getElementById('logBox');
                const p = document.createElement('p');
                p.textContent = message;
                if (color) {
                    p.style.color = color;
                }
                logBox.appendChild(p);
                logBox.scrollTop = logBox.scrollHeight;
            }
            
            // Utility function to remove quotes
            function cleanPathQuotes(pathString) {
                if (typeof pathString === 'string') {
                    // Remove leading and trailing double quotes (")
                    return pathString.replace(/^"|"$/g, '').trim();
                }
                return pathString;
            }

            // UPDATED: Applies cleaning to UI input value directly on change
            function saveInput(event) {
                const input = event.target;
                if (input.type === 'text') {
                    const cleanedValue = cleanPathQuotes(input.value);
                    
                    // 1. Update the UI input field immediately (the change you requested)
                    input.value = cleanedValue; 

                    // 2. Save the cleaned value to localStorage
                    localStorage.setItem(input.id, cleanedValue); 
                } else if (input.type === 'checkbox') {
                    localStorage.setItem(input.id, input.checked ? 'on' : 'off');
                }
            }
            
            function loadInputs() {
                const textInputs = document.querySelectorAll('input[type="text"]');
                textInputs.forEach(input => {
                    const savedValue = localStorage.getItem(input.id);
                    if (savedValue !== null) {
                        input.value = savedValue;
                    }
                });
                
                const checkboxInput = document.getElementById('obfuscateJsx');
                if (checkboxInput) {
                    const savedCheck = localStorage.getItem(checkboxInput.id);
                    if (savedCheck === 'on') {
                        checkboxInput.checked = true;
                    } else {
                        checkboxInput.checked = false;
                    }
                }
            }

            function populateFormFromCard(settings) {
                const form = document.getElementById('signerForm');
                for (const key in settings) {
                    if (settings.hasOwnProperty(key)) {
                        const input = form.querySelector(\`#\${key}\`);
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = settings[key] === 'on';
                            } else {
                                input.value = settings[key];
                            }
                        }
                    }
                }
                logMessage('Settings loaded successfully!', '#34d399');
            }

            function deleteSettings(index) {
                let savedSettings = JSON.parse(localStorage.getItem('savedSettings') || '[]');
                
                if (index >= 0 && index < savedSettings.length) {
                    const deletedSetting = savedSettings[index];
                    savedSettings.splice(index, 1);
                    localStorage.setItem('savedSettings', JSON.stringify(savedSettings));
                    logMessage(\`Settings for "\${deletedSetting.certName}" deleted.\`, '#f87171');
                    renderSettingsCards();
                }
            }

            function renderSettingsCards() {
                const panel = document.getElementById('savedSettingsPanel');
                panel.innerHTML = '';
                const savedSettings = JSON.parse(localStorage.getItem('savedSettings') || '[]');
                
                if (savedSettings.length === 0) {
                    panel.innerHTML = '<p style="text-align: center; color: #999;">Double-click a card to load settings.</p>';
                } else {
                    savedSettings.forEach((settings, index) => {
                        const card = document.createElement('div');
                        card.classList.add('saved-settings-card');

                        // 1. Content Area
                        const contentDiv = document.createElement('div');
                        contentDiv.classList.add('card-content-area');
                        contentDiv.innerHTML = \`
                            <h3>\${settings.certName}</h3>
                            <p>\${settings.outputPath}</p>
                        \`;
                        
                        contentDiv.addEventListener('dblclick', () => populateFormFromCard(settings));
                        
                        // 2. Delete Button
                        const deleteBtn = document.createElement('button');
                        deleteBtn.classList.add('delete-btn');
                        deleteBtn.innerHTML = '&times;'; 
                        
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            deleteSettings(index);
                        });

                        card.appendChild(contentDiv);
                        card.appendChild(deleteBtn);
                        panel.appendChild(card);
                    });
                }
            }

            document.addEventListener('DOMContentLoaded', () => {
                loadInputs();
                renderSettingsCards();
                
                const inputs = document.querySelectorAll('input');
                inputs.forEach(input => {
                    input.addEventListener('change', saveInput);
                });
            });

            document.getElementById('signerForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const form = event.target;
                
                logMessage('Starting process: Certificate creation, Signing, and Verification...', '#999');
                
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                data.obfuscateJsx = form.querySelector('#obfuscateJsx').checked ? 'on' : 'off';
                
                try {
                    const response = await fetch('/sign', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();
                    if (response.ok) {
                        logMessage(result.message, '#34d399');
                        
                        // --- START OF DUPLICATE CHECK AND SAVE LOGIC ---
                        const settingsToSave = { ...data };
                        delete settingsToSave.certPassword;

                        // Ensure paths are clean before saving/comparison
                        for (const key in settingsToSave) {
                            if (form.querySelector(\`#\${key}\`) && form.querySelector(\`#\${key}\`).type === 'text') {
                                settingsToSave[key] = cleanPathQuotes(settingsToSave[key]);
                            }
                        }

                        let savedSettings = JSON.parse(localStorage.getItem('savedSettings') || '[]');
                        const newSettingsString = JSON.stringify(settingsToSave);

                        // Check if an identical setting already exists
                        const isDuplicate = savedSettings.some(setting => {
                            const settingForComparison = { ...setting };
                            delete settingForComparison.certPassword;
                            
                            return JSON.stringify(settingForComparison) === newSettingsString;
                        });

                        if (!isDuplicate) {
                            savedSettings.unshift(settingsToSave);
                            if (savedSettings.length > 20) {
                                savedSettings.pop(); 
                            }
                            localStorage.setItem('savedSettings', JSON.stringify(savedSettings));
                            logMessage('New settings saved successfully.', '#93c5fd');
                        } else {
                            logMessage('Settings already in saved list. Skipping save.', '#fde047');
                        }
                        // --- END OF DUPLICATE CHECK AND SAVE LOGIC ---

                        renderSettingsCards();
                    } else {
                        logMessage('Error: ' + (result.error || 'Failed to complete the process.'), '#f87171');
                    }
                } catch (error) {
                    logMessage('Network Error: Could not connect to the server.', '#f87171');
                    console.error('Fetch error:', error);
                }
            });
        </script>
    </body>
    </html>
    `;
    res.send(htmlContent);
});

app.post('/sign', async (req, res) => {
    // --- APPLY QUOTE CLEANING TO ALL USER-SUBMITTED PATHS ---
    let { inputPath, outputPath, certPath, certPassword, certCountry, certState, certOrg, certName, timestampUrl, obfuscateJsx } = req.body;

    inputPath = cleanPathQuotes(inputPath);
    outputPath = cleanPathQuotes(outputPath);
    certPath = cleanPathQuotes(certPath);

    const resolvedInputPath = path.resolve(inputPath);
    const resolvedOutputPath = path.resolve(outputPath);
    const resolvedCertPath = path.resolve(certPath);

    // --- Temporary Build Folder Setup ---
    let tempDirName = `zxp_build_${crypto.randomBytes(8).toString('hex')}`;
    let tempInputPath = path.join(os.tmpdir(), tempDirName);
    let tempManifestPath;

    const signingInputPath = tempInputPath;

    // Variables for manifest/file cleanup
    let originalManifestContent = '';
    let originalAbsoluteJsxPath = '';

    try {
        // 1. Directory creation check for the ZXP output file
        const outputDir = path.dirname(resolvedOutputPath);
        await fsPromises.mkdir(outputDir, { recursive: true });

        // 2. Create and populate temporary directory
        console.log(`Creating and copying files to temporary build directory: ${signingInputPath}`);
        await fsPromises.cp(resolvedInputPath, signingInputPath, { recursive: true, force: true });

        // 3. JSXBIN Compilation/Obfuscation Step (performed on the temp files)
        let obfuscationMessage = '';
        tempManifestPath = path.join(signingInputPath, 'CSXS', 'manifest.xml');

        if (obfuscateJsx === 'on') {
            if (!fs.existsSync(tempManifestPath)) {
                throw new Error('JSXBIN requested, but manifest.xml not found in the temporary build folder.');
            }

            // a. Read manifest content from the temporary folder
            originalManifestContent = await fsPromises.readFile(tempManifestPath, 'utf8');

            // Regex to find the <ScriptPath>...</ScriptPath> content inside the manifest
            const scriptTagRegex = /<ScriptPath>(.*?)<\/ScriptPath>/;
            const match = originalManifestContent.match(scriptTagRegex);

            if (!match || match.length < 2) {
                throw new Error('JSXBIN compilation failed: Could not find <ScriptPath> tag in manifest.xml to determine main ExtendScript file path.');
            }

            const originalRelativeJsxPath = match[1].trim();
            originalAbsoluteJsxPath = path.join(signingInputPath, originalRelativeJsxPath);

            if (!fs.existsSync(originalAbsoluteJsxPath)) {
                throw new Error('JSXBIN compilation failed: Original ExtendScript file not found at: ' + originalAbsoluteJsxPath);
            }

            // b. Determine new file name
            const originalExt = path.extname(originalAbsoluteJsxPath);
            const originalBase = path.basename(originalAbsoluteJsxPath, originalExt);
            const originalDir = path.dirname(originalAbsoluteJsxPath);

            const obfuscatedFileName = `${originalBase}.jsxbin`;
            const newAbsoluteJsxPath = path.join(originalDir, obfuscatedFileName);

            // c. Execute actual jsxbin compilation
            console.log(`Starting jsxbin compilation for: ${originalAbsoluteJsxPath} -> ${newAbsoluteJsxPath}`);
            await jsxbin(originalAbsoluteJsxPath, newAbsoluteJsxPath);

            // d. Update manifest content to point to the new .jsxbin file
            const newRelativeJsxPath = originalRelativeJsxPath.replace(originalExt, '.jsxbin').replace(/\\/g, '/');

            const newManifestContent = originalManifestContent.replace(
                scriptTagRegex,
                `<ScriptPath>${newRelativeJsxPath}</ScriptPath>`
            );
            await fsPromises.writeFile(tempManifestPath, newManifestContent, 'utf8');

            // e. Delete the original .jsx file from the temporary folder
            await fsPromises.unlink(originalAbsoluteJsxPath);

            obfuscationMessage = `JSXBIN compilation complete: Created '${obfuscatedFileName}', **deleted original source file**, and updated manifest.xml in the temporary folder.`;
            console.log(obfuscationMessage);
        }

        // 4. Command definitions (using the temporary folder path)
        const zxpsigncmdPath = zxpProvider();

        // Wrap all path variables in quotes for safe execution on all OS (e.g., paths with spaces)
        const createCertCommand = `"${zxpsigncmdPath}" -selfSignedCert "${certCountry}" "${certState}" "${certOrg}" "${certName}" "${certPassword}" "${resolvedCertPath}"`;
        const signCommand = `"${zxpsigncmdPath}" -sign "${signingInputPath}" "${resolvedOutputPath}" "${resolvedCertPath}" "${certPassword}" -tsa "${timestampUrl}"`;
        const verifyCommand = `"${zxpsigncmdPath}" -verify "${resolvedOutputPath}"`;

        // 5. Execute command chain
        console.log('Executing ZXP signing command chain...');
        const commandChain = `${createCertCommand} && ${signCommand} && ${verifyCommand}`;

        const { stdout, stderr } = await executeCommand(commandChain);

        // 6. Success message construction
        let finalMessage = `Success! Extension ZXP created, signed, time-stamped, and **VERIFIED**.\n`;
        if (obfuscationMessage) {
            finalMessage += `\n**JSXBIN Status:** ${obfuscationMessage}\n`;
        }
        finalMessage += `ZXP saved at: ${resolvedOutputPath}.\n\n--- Full Terminal Output (including Verification) ---\n${stdout}`;

        // Send success response
        res.status(200).json({ message: finalMessage });

    } catch (e) {
        // Handle all errors (copy, jsxbin, or signing command execution)
        console.error('Process failed:', e);

        let errorMessage = 'An unknown error occurred.';

        if (e.code === 'ENOENT' && e.path === resolvedInputPath) {
            errorMessage = `Input Path Error: The extension folder was not found at the specified path: ${resolvedInputPath}. Please check the path and permissions.`;
        } else if (e.error) { // Error from executeCommand (signing failure)
            const { error, stdout, stderr } = e;
            if (stderr.includes("Is a directory")) {
                errorMessage = "Command failed: The output path for the ZXP file or the certificate path is a directory, but must be a file path. Please ensure 'outputPath' and 'certPath' include a filename (e.g., my-extension.zxp and my-cert.p12).";
            } else if (stderr.includes("TSA")) {
                errorMessage = `Command failed: Signing/timestamping failed. Please verify the Timestamp Server URL is correct and reachable.\nStderr: ${stderr}`;
            } else if (error.message.includes(verifyCommand) && error.code !== 0) {
                errorMessage = `Signing completed but the **Verification Failed**! The ZXP signature is invalid or corrupt.\nStderr: ${stderr}\nStdout: ${stdout}`;
            } else {
                errorMessage = `Command failed during execution: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`;
            }
        } else { // Error from JSXBIN or other file operations
            errorMessage = e.message;
        }

        res.status(500).json({ error: errorMessage });

    } finally {
        // --- 7. Guaranteed Cleanup: Delete temporary build folder ---
        if (fs.existsSync(signingInputPath)) {
            try {
                // Revert manifest.xml in the temporary folder before deleting, just in case 
                if (obfuscateJsx === 'on' && originalManifestContent && fs.existsSync(tempManifestPath)) {
                    await fsPromises.writeFile(tempManifestPath, originalManifestContent, 'utf8');
                }

                console.log(`Cleaning up temporary directory: ${signingInputPath}`);
                await fsPromises.rm(signingInputPath, { recursive: true, force: true });
                console.log('Cleanup complete.');
            } catch (cleanupError) {
                console.error('CRITICAL: Failed to clean up temporary directory:', cleanupError.message);
            }
        }
    }
});

app.listen(port, () => {
    console.log(`ZXP Signer backend running at http://localhost:${port}`);
    console.log(`Open your browser and navigate to the address above to use the tool.`);
});