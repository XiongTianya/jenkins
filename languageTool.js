let workspaceDir = process.argv[2];
let spreadSheetsId = process.argv[3]
workspaceDir = workspaceDir + '/specific_directory/assets'

const axios = require('axios');
const fs = require('fs').promises
const fsSycn = require('fs')
const XLSX = require('xlsx');
const path = require('path');

async function downloadAndParseGoogleSheet() {
    try {
        console.log("downloadAndParseGoogleSheet")
        const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadSheetsId}/export?format=xlsx`;
        const response = await axios.get(exportUrl, {
            responseType: 'arraybuffer'
        });
        // 解析 Excel 文件并保存为 JSON 文件
        parseExcelToJSON(response.data);

    } catch (error) {
        console.error('An error occurred:', error);
    }
}

function parseExcelToJSON(fileData) {
    const workbook = XLSX.read(fileData, { type: 'buffer' });

    // 解析每个工作表
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        var range = {
            s: { c: 2, r: 1 },
            e: XLSX.utils.decode_range(worksheet['!ref']).e
        };
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 2, range: range });
        console.log("jsonDataLen:", jsonData.length)
        let len = jsonData.length
        let json = {}
        for (let i = 0; i < len; i++) {
            let data = jsonData[i]
            let keys = Object.keys(data)
            let keysLen = keys.length
            let lanKey = data[keys[0]]
            if (!lanKey) {
                continue
            }
            json[lanKey] = {}
            for (let j = 1; j < keysLen; j++) {
                json[lanKey][keys[j]] = data[keys[j]] || ""
            }
        }

        jsonToJsFile(sheetName, json)
    });
}

async function jsonToJsFile(fileName, datas) {
    let jsFile = ""
    let signCode = `
let SIGN
try {
    SIGN = require("CurrencySign").currencySign
} catch (error) {
    SIGN = \'\${SIGN}\'
}\n`
    if (fileName == 'GameCommon') {
        jsFile += `
let SIGN
let ADDRESS
try {
    SIGN = require("CurrencySign").currencySign
    ADDRESS = require("CurrencySign").mainAddress

} catch (error) {
    SIGN = '\${SIGN}'
    ADDRESS = '\${ADDRESS}'
}\n`
    } else {
        jsFile += signCode
    }

    jsFile += `const ${fileName} = {\n`
    let jsFileSecond = signCode + `const ${fileName + 'Second'} = {\n`
    let jsFileThird = signCode + `const ${fileName + 'Third'} = {\n`

    for (let key in datas) {
        let data = datas[key] || {}
        let val = data['en'] || ''
        let valSecond = data['in'] || val
        let valThird = data['bn'] || val
        val = val ? replaceStr(val) : '\'\''
        valSecond = valSecond ? replaceStr(valSecond) : '\'\''
        valThird = valThird ? replaceStr(valThird) : '\'\''
        jsFile += '    ' + key + ': ' + val + ',\n'
        jsFileSecond += '    ' + key + ': ' + valSecond + ',\n'
        jsFileThird += '    ' + key + ': ' + valThird + ',\n'
    }

    jsFile += `}\nmodule.exports = ${fileName}`
    jsFileSecond += `}\nmodule.exports = ${fileName + 'Second'}`
    jsFileThird += `}\nmodule.exports = ${fileName + 'Third'}`

    saveFile(fileName, fileName, jsFile)
    saveFile(fileName, fileName + 'Second', jsFileSecond)
    saveFile(fileName, fileName + 'Third', jsFileThird)
}

async function saveFile(key, fileName, data) {
    let folderPath = languageFileMap[key]
    let filePath = path.join(folderPath, fileName + '.js')
    fsSycn.writeFileSync(filePath, data, 'utf8', (writeErr) => {
        console.log('file save sucess:', filePath)
        if (writeErr) {
            console.error('Error writing data to file:', writeErr);
        }
    });
}


function replaceStr(str) {
    if (!str.replace) {
        console.log('err str:', str)
        return ""
    }
    str = str.replace(/\n/g, '\\n').replace(/\"/g, '\\"')
    if (str && ((str.indexOf('${SIGN}') > -1) || str.indexOf('${ADDRESS}') > -1)) {
        str = '\`' + str + '\`'
    } else {
        str = '\"' + str + '\"'
    }
    return str
}


const languageFileMap = {}
//遍历目录，筛选出多语言文件
async function traverseDirectory(dirPath) {
    try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory() && file === 'multilingualism') {
                const folderFiles = await fs.readdir(filePath);
                if (folderFiles.length > 0) {
                    const firstFileName = path.parse(folderFiles[0]).name;
                    languageFileMap[firstFileName] = filePath
                }
            }
            if (stats.isDirectory()) {
                await traverseDirectory(filePath);
            }
        }
    } catch (error) {
        console.error('Error during traversal:', error);
    }
}

traverseDirectory(workspaceDir)
    .then(() => {
        downloadAndParseGoogleSheet()
    })
    .catch((error) => {
        console.error('Multilingual file filtering failed:', error);
    });

