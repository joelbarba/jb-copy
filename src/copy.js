import fs from 'fs';
import path from 'path';
import process from 'process';
import { exec } from 'child_process';
import { init, exit, cmd, sleep, dirExist, formatTime, formatSize, pad } from 'jb-node-lib';
import { move, print, line, repeat, color, setColor, resetColor, printBox } from 'jb-node-lib';
import { black, red, green, yellow, blue, magenta, cyan, white, gray } from 'jb-node-lib';

const excludeDirs = [
  { name: 'node_modules', isExcluded: true },
  { name: '.git',         isExcluded: true },
  { name: '.env',         isExcluded: true },
  { name: '.angular',     isExcluded: true },
  { name: '.next',        isExcluded: true },
  { name: 'bin',          isExcluded: false },
  { name: 'cache',        isExcluded: true },
];


/*******************************************************************************************
 Param1: Target folder to copy
 Param2: Base destination path where to copy
 A new folder with the name of the original folder will be created on "Param2" path.
 Add to .bashrc: alias copy="node ~/joel_scripts/copy.js $1 $2"
 
 Example:
    copy /home/barba/DEV/JB-PIANO /media/DISK12/PROGRAMES_PROPIS --run
  
 This will create a new folder ------> /media/DISK12/PROGRAMES_PROPIS/JB-PIANO  and copy *.* within
*******************************************************************************************/
init();
let fromPath = process.argv[2] || process.cwd();  // Full path of the directory to copy
let toPath = process.argv[3] || process.cwd();    // Path of the destination where the copy is going to be created
let autoRun = process.argv[4] === '--run';        // If present, it automatically starts the copy
                                                  // If not present, the menu is shown and you can navigate the options
if (fromPath.at(-1) === '/') { fromPath = fromPath.slice(0, -1); } // If present, remove the last '/'
if (toPath.at(-1) === '/')   { toPath = toPath.slice(0, -1); }     // If present, remove the last '/'

if (fromPath[0] !== '/') { fromPath = '/' + fromPath; }


if (!fs.existsSync(fromPath)) {
  fromPath = process.cwd() + fromPath;
  if (!dirExist(fromPath)) { fromPath = process.cwd(); }
}


// ------------------------------------------------------------------------------------------------------------
process.stdin.on('keypress', (str, key) => {
  if (key.name === 'c' && key.ctrl) { 
    // console.clear();
    move(1, height + 14);
    process.exit(0); 
  }
  // if (isBusy) { return; }
  // print(key.name, 120, 0);
  // print('op = ' + op + ', status = ' + status, 30, 60);

  // if (key.name === 'return') { updateStatus(status + 1); }
  // if (key.name === 'escape') { updateStatus(status - 1); }

  if (status === 1 || status === 2 || status === 3) {
    if (key.name === 'right') { 
      if (status === 1) { status = 2; printAll(); return; }
      if (status === 2) { status = 3; printAll(); return; }
    }
    if (key.name === 'left') { 
      if (status === 2) { status = 1; printAll(); return; }
      if (status === 3) { status = 2; printAll(); return; }
    }    
  }

  if (status === 1) { // Options
    if (key.name === 'up')   { printOptions(op - 1); }
    if (key.name === 'down') { printOptions(op + 1); }
    if (key.name === 'space' || key.name === 'return') {
      if (op === 1) { return preCopyScan(); }      // Start Copy
      if (op === 2) { analyseDir(fromPath, 100); } // Analyze Dir
      if (op === 3) { 
        showHidden = !showHidden;
        cdDirA(fromPath);
        cdDirB(toPath);
        printOptions(); 
      }
      if (op > 3) { excludeDirs[op - 4].isExcluded = !excludeDirs[op - 4].isExcluded; printOptions(); }
    } 
  }

  if (status === 2) {
    if (key.name === 'up')       { moveCursorUp(  1, 'A'); }
    if (key.name === 'down')     { moveCursorDown(1, 'A'); }

    if (key.name === 'pageup')   { moveCursorUp(  15, 'A'); }
    if (key.name === 'pagedown') { moveCursorDown(15, 'A'); }
    
    if (key.name === 'home')     { moveCursorUp(  fileListA.length, 'A'); }
    if (key.name === 'end')      { moveCursorDown(fileListA.length, 'A'); }
    
    if (key.name === 'return') {
      if (selA?.type === 'dir') { cdDirA(fromPath + '/' + selA.name); }
      else if (selA?.type === 'back') { moveDirUp(fromPath, cdDirA); }
    }
  }

  if (status === 3) {
    if (key.name === 'up')       { moveCursorUp(  1, 'B'); }
    if (key.name === 'down')     { moveCursorDown(1, 'B'); }

    if (key.name === 'pageup')   { moveCursorUp(  15, 'B'); }
    if (key.name === 'pagedown') { moveCursorDown(15, 'B'); }
    
    if (key.name === 'home')     { moveCursorUp(  fileListB.length, 'B'); }
    if (key.name === 'end')      { moveCursorDown(fileListB.length, 'B'); }
    
    if (key.name === 'return') {
      if (selB?.type === 'dir') { cdDirB(toPath + '/' + selB.name); }
      else if (selB?.type === 'back') { moveDirUp(toPath, cdDirB); }
    }
  }


  if (status === 5) { // Confirm option
    if (key.name === 'right') { op = 2; printConfirm(); }
    if (key.name === 'left')  { op = 1; printConfirm(); }
    if (key.name === 'return') {
      if (op === 2) { return backToStart(); } // cancel
      if (op === 1) { return startCopy(); }
    }
  }

  if (status === 7) { // Copy file error confirm
    if (key.name === 'return') { errorFile = null; return copyFiles(); }
    if (key.name === 's') { errorFile.copied = true; return copyFiles(); }
    if (key.name === 'y') { errorFile.copied = true; return copyFiles('ignore'); }
    if (key.name === 'escape') { return backToStart(); }
  }

});

function getColParams(colName) {
  const selInd       = colName === 'A' ? selIndA       : selIndB;
  const scroll       = colName === 'A' ? scrollA       : scrollB;
  const hoverFile    = colName === 'A' ? hoverFileA    : hoverFileB;
  const scrollList   = colName === 'A' ? scrollListA   : scrollListB;
  const printDirFrom = colName === 'A' ? printDirFromA : printDirFromB;
  const fileList     = colName === 'A' ? fileListA     : fileListB;
  return { selInd, scroll, hoverFile, scrollList, printDirFrom, fileList };
}

function moveCursorUp(jump = 1, colName) {
  const { selInd, scroll, hoverFile, scrollList, printDirFrom } = getColParams(colName);
  const maxJump = selInd;
  if (jump > maxJump) { jump = maxJump; }
  if (jump > 0) {
    const diff = scroll - (selInd - jump);
    if (diff > 0) { scrollList(-diff); } // scroll up
    hoverFile(selInd - jump);
    printDirFrom();
  }
}


function moveCursorDown(jump = 1, colName) {
  const { selInd, scroll, hoverFile, scrollList, printDirFrom, fileList } = getColParams(colName);
  const maxJump = fileList.length - selInd - 1;
  // print(`selInd=${selInd}, scroll=${scroll}, height=${height}, fileList[].lenght=${fileList.length}, jump=${jump}, maxJump=${maxJump}    `, 0, 41);
  if (jump > maxJump) { jump = maxJump; }
  if (jump > 0) {
    const diff = (selInd + jump) - scroll - height;
    if (diff > 0) { scrollList(diff); } // scroll down
    hoverFile(selInd + jump);
    printDirFrom();
    // print(`diff=${diff}    `, 0, 43);
  }
}


function moveDirUp(path, cdDir) { // Select the parent directory
  const pArr = path.split('/');
  pArr.pop();
  cdDir(pArr.join('/'));
}
function hoverFileA(index) { selIndA = index; selA = fileListA[selIndA]; }
function hoverFileB(index) { selIndB = index; selB = fileListB[selIndB]; }

function scrollListA(diff) { scrollA += diff; }
function scrollListB(diff) { scrollB += diff; }

// ------------------------------------------------------------------------------------------------------------



let fileListA = [];     // List of files/dirs of the current selected path
let selIndA = 0;        // Index of currFileList for the current selected file
let selA = null;        // Current selected item from currFileList ---> currSel = currFileList[selInd]
let scrollA = 0;        // Scroll of the box list 

let fileListB = [];
let selIndB = 0;
let selB = null;
let scrollB = 0;

let showHidden = false;

let op = 1; // current option from status 1
let status = 1;  // 1 = options, 2 = from files, 3 = to files, 
                 // 4 = scanning (pre copy), 
                 // 5 = scan and confirm (pre copy), 
                 // 6 = copy progress, 
                 // 7 = copy error stop, 
                 // 8 = finished

const height = 30;
const width1 = 40, width2 = 60, width3 = 60;
const width = width1 + width2 + width3;


function printScreen() {
  const x = 0, y = 3;

  setColor('white', 'dim');
  print(`Directory to duplicate -------> `, 1, 1);
  print(`Path where to duplicate it ---> `, 1, 2);

  print(`┌${repeat(width1, '─')}┬${repeat(width2, '─')}┬${repeat(width3, '─')}┐`, x, y + 1);
  print(`│ Options:`, x, y + 2);
  print(`│ Copy:`, x + width1 + 1, y + 2);
  print(`│ To:`, x + width1 + width2 + 2, y + 2);
  print(`│`, x + width1 + width2 + width3 + 3, y + 2);
  for (let t = 0; t <= height + 1; t++) {
    print(`│`, x, y + t + 2);
    print(`│`, x + width1 + 1, y + t + 2);
    print(`│`, x + width1 + width2 + 2, y + t + 2);
    print(`│`, x + width1 + width2 + width3 + 3, y + t + 2);
  }
  print(`└${repeat(width1, '─')}┴${repeat(width2, '─')}┴${repeat(width3, '─')}┘`, x, y + height + 4);

  print(`├${repeat(width1, '─')}┤`, 0, y + height - 3);
  // print(`├┤`, 0, hOffset + 2);

  print(`- Folders to exclude:`, x + 2, y + 10);
  
  resetColor();

  print(white(`Copy:`), x + width1 + 3, y + 2);
  print(white(`To:`),   x + width1 + width2 + 4, y + 2);
  // print(`├${hLine}┤`, 0, hOffset + 2);
  // print(` ${cyan('↑↓')} Move,   ${cyan('←')} Directory Up,   ${cyan('→')} Directory In,   ${cyan('Enter')}: Select Directory,   ${cyan('h')}: Show Hidden,   ${cyan('c')}: Get Directory Info`, 0, hOffset + height + 3);
  // printDirFromA();
}


function printAll() {
  printMain();
  print(repeat(width1 + width2 + width3, ' '), 0, height + 10);
  if (status === 1) { printDirFromA(); printDirFromB(); printOptions(); }
  if (status === 2) { printOptions(); printDirFromB(); printDirFromA(); }
  if (status === 3) { printOptions(); printDirFromA(); printDirFromB(); }
}

function printMain() {
  const maxLength = width1 + width2 + width3 - 30;    
  print(repeat(maxLength, ' '), 33, 1); // Clear previous values
  print(repeat(maxLength, ' '), 33, 2); // Clear previous values

  let pArr = fromPath.split('/');
  let lastName = pArr.pop();
  let basePath = pArr.join('/');
  if (fromPath.length > maxLength) { // in case the path is too long
    pArr = fromPath.slice(-maxLength).split('/');
    basePath = '..' + pArr.join('/') || '/';
  }
  print(`${basePath}/${color(lastName, 'yellow')}`, 33, 1);

  if (basePath === toPath) { lastName += '_copy'; }
  print(`${color(toPath + '/', 'white')}${color(lastName, 'green')}`, 33, 2);
  print(gray(`A new directory "`) + green(lastName) + gray(`" will be created on ${toPath}/`), 1, height + 8); 
}


function printOptions(newOp = op) {
  if (newOp > 0 && newOp < excludeDirs.length + 4) { op = newOp; }

  function opEffect(sel) { return 'bright' + (status === 1 && sel === op ? ' reverse' : ''); }

  const x = 0, y = 3;
  print(color(`- Start Copy `,        'cyan', opEffect(1)), x + 2, y + 4);
  print(color(`- Analyse Directory `, 'cyan', opEffect(2)), x + 2, y + 6);
  print(color(`[${showHidden ? 'X':' '}] Show Hidden Files `, 'cyan', opEffect(3)), x + 2, y + 8);

  excludeDirs.forEach((dir, ind) => {
    print(color(`[${dir.isExcluded ? 'X':' '}] ${dir.name} `, 'cyan', opEffect(4 + ind)), x + 4, y + ind + 12);
  });

  if (status === 1) {
    if (op === 1) { move(x + 2, y + 4); }
    if (op === 2) { move(x + 2, y + 6); }
    if (op === 3) { move(x + 3, y + 8); }
    if (op > 3)   { move(x + 5, y + op + 8); }
  }
}




function printDirFromA() {
  const x = width1 + 3, y = 6;
  // print('op = ' + op + ', status = ' + status + ', selIndA = ' + selIndA, 30, 60);

  for (let t = 0; t <= height; t++) {
    const row = y + t;
    const ind = scrollA + t;
    print(repeat(width2 - 1, ' '), x, row); // Delete previous content

    if (ind < fileListA.length) {
      const file = fileListA[ind];
      const prefix = ind === fileListA.length - 1 ? '└─ ' : '├─ ';
      printFile(file, prefix, x, row, status === 2 && selIndA === ind, width2);
    }
  }  

  if (scrollA > 0) { print(`↑`, x + width2 - 2, y); }
  if (fileListA.length > scrollA + height) { print(`↓`, x + width2 - 2, y + height); }

  if (status === 2) { move(x + 2, y + selIndA - scrollA); }
}
function printDirFromB() {
  const x = width1 + width2 + 4, y = 6;

  for (let t = 0; t <= height; t++) {
    const row = y + t;
    const ind = scrollB + t;
    print(repeat(width3 - 1, ' '), x, row); // Delete previous content

    if (ind < fileListB.length) {
      const file = fileListB[ind];
      const prefix = ind === fileListB.length - 1 ? '└─ ' : '├─ ';
      printFile(file, prefix, x, row, status === 3 && selIndB === ind);
    }
  }  

  if (scrollB > 0) { print(`↑`, x + width3 - 2, y); }
  if (fileListB.length > scrollB + height) { print(`↓`, x + width3 - 2, y + height); }

  if (status === 3) { move(x + 2, y + selIndB - scrollB); }
}
function printFile(file, prefix, x, row, isSel, width = 60) {
  const size = ' ' + formatSize(file.size);
  const name = file.name.slice(0, width - (file.type === 'dir' ? 6 : 15));

  if (file.size) { print(color(repeat(width - 2, '.'), 'gray', ''), x, row); } // dotted line

  if (isSel) { // If this is the current selection
    if (file.type === 'dir')  { print(prefix + color(`/${name}`, 'black', '', 'white'), x, row); }
    if (file.type === 'back') { print(prefix + color(`/${name}`, 'black', '', 'white'),  x, row); }
    if (file.type === 'file') { print(prefix + color(`${name}`,  'white', '', 'gray'), x, row); }
    if (file.size) { print(color(`${size}`, 'black', '', 'white'), x + width - size.length - 2, row); }

  } else { // Print for non selected
    if (file.type === 'back') { print(prefix + color(`/${name}`, 'white', 'dim'), x, row); }
    if (file.type === 'dir')  { print(prefix + color(`/${name}`, 'white', 'bright'),   x, row); }
    if (file.type === 'file') { print(prefix + color(`${name}`,  'white', 'dim'), x, row); }
    if (file.size) { print(color(`${size}`, 'white', ''), x + width - size.length - 2, row); }
  }
}


function printConfirm() {
  const x = 1, y = height + 10;
  if (status === 5) {
    print(repeat(50, ' '), x, y);
    print(red('Confirm: '), x, y);
    if (op === 1) {
      print(color(` OK `, 'white', 'reverse'), x + 10, y);
      print(color(` Cancel `, 'white'), x + 15, y);
      move(x + 14, y);
    } else {
      print(color(` OK `, 'white'), x + 10, y);
      print(color(` Cancel `, 'white', 'reverse'), x + 15, y);
      move(x + 23, y);
    }
  }
}


function getPrintableDirList(dir) {
  const list = getDirList(dir || '/', showHidden).sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') { return -1; }
    if (a.type !== 'dir' && b.type === 'dir') { return 1; }
    return a.name.toUpperCase() > b.name.toUpperCase() ? 1: -1;
  });
  if (dir !== '') {
    list.unshift({ type: 'back', name: '..', path: dir, size: 0 });
  }
  return list;
}


function cdDirA(dir) {
  fileListA = getPrintableDirList(dir);
  fromPath = dir;
  scrollA = 0;
  hoverFileA(0);

  print(repeat(width2 - 7, ' '), width1 + 9, 5);
  let dirName = fromPath.split('/').reverse()[0];
  if (dirName) { dirName = `.../${dirName}`; }
  print(yellow(dirName || '/'), width1 + 9, 5);

  // Match directories with scanned ones to add their sizes (if there are)
  const dirs = allFiles.filter(f => f.type === 'dir');
  fileListA.filter(d => d.type === 'dir').forEach(d => d.size = dirs.find(dir => dir.path === d.path)?.size);

  printMain();
  printDirFromA();
}

function cdDirB(dir) {
  fileListB = getPrintableDirList(dir);
  toPath = dir;
  scrollB = 0;
  hoverFileB(0);

  print(repeat(width3 - 7, ' '), width1 + width2 + 9, 5);
  let dirName = toPath.split('/').reverse()[0];
  if (dirName) { dirName = `.../${dirName}/`; }
  print(color(dirName || '/', 'white') + color(' ←', 'green'), width1 + width2 + 9, 5);

  printMain();
  printDirFromB();
}


function backToStart() {
  print(repeat(width, ' '), 0, height + 8);
  print(repeat(width, ' '), 0, height + 9);
  print(repeat(width, ' '), 0, height + 10);
  print(repeat(width, ' '), 0, height + 11);
  print(repeat(width, ' '), 0, height + 12);
  status = 1;
  op = 1;
  printAll();
}



(async function run() {
  console.clear();  
  
  // print('process.argv[0] = ' + process.argv[0], 1, 45);
  // print('process.argv[1] = ' + process.argv[1], 1, 46);
  // print('process.argv[2] = ' + process.argv[2], 1, 47);
  // print('process.argv[3] = ' + process.argv[3], 1, 48);
  // print('process.argv[4] = ' + process.argv[4], 1, 49);
  // print('fromPath = ' + fromPath, 1, 50);
  // print('process.cwd() = ' + process.cwd(), 1, 51);

  exec('resize -s 50 170', (err, stdout, stderr) => { // Set terminal size 70 rows, 220 cols
    // print('Terminal size: ' + process.stdout.columns + 'x' + process.stdout.rows, 1, 51);

    printScreen();

    cdDirA(fromPath);
    cdDirB(toPath);
    printAll();

    // fromPath = '/home/barba/AAA.tmp/jb-icomoon';
    // toPath = '/home/barba/AA2.tmp';
    // analyseDir(fromPath);
    // preCopyScan();
    // startCopy();

    if (autoRun) { preCopyScan(); }
  });

  // print(`\n\nProcess completed`);
  // process.exit(0);
}());


// ------------------------------------- Backend Ops ---------------------------------------------

function getDirList(dir, addHidden = true) {  // dir should be the full path
  try {
    const list = [];
    const files = fs.readdirSync(dir);
    for (let file of files) {
      const fullPath = path.join(dir, file);
      if (!fs.existsSync(fullPath)) { // In case of broken Symlink
        // console.log('Broken Symlink (skipping) --> ', fullPath);
      } else {
        const fileStat = fs.statSync(fullPath);

        if (addHidden || file[0] !== '.') {
          if (fileStat.isFile()) {
            list.push({ type: 'file', name: file, path: fullPath, size: fileStat.size });
          } else if (fileStat.isDirectory()) {
            list.push({ type: 'dir', name: file, path: fullPath, size: 0 });
          }
        }
      }
    }
    return list;

  } catch(err) { console.log('ERROR', err); process.exit(1); }    
}


function getNewFolderName() {
  const dirName = fromPath.split('/').reverse()[0]; // Single name of the directory to duplicate

  let newFolder = toPath + '/' + dirName;
  if (dirExist(newFolder)) { newFolder += '_copy'; } // If it exists, try to extend the name "copy"
  let copyNum = 2;
  while (dirExist(newFolder) || copyNum > 1000) { // If still exists, try to add a number
    newFolder = `${toPath}/${dirName}_copy_${copyNum++}`;
  }
  const lastName = newFolder.split('/').reverse()[0];
  print(gray(`A new directory "`) + green(lastName) + gray(`" will be created on ${toPath}/`), 1, height + 8);
  return newFolder;
}



let allFiles = []; // Global list with all recursively scanned files and subdirectories
function analyseDir(rootDir, delay = 0) {
  print(repeat(width1, ' '), 1, 31);
  print(repeat(width1, ' '), 1, 33);
  print(repeat(width1, ' '), 1, 34);
  print(repeat(width1, ' '), 1, 35);
  print(`Directory: ${yellow(rootDir.split('/').reverse()[0])}`, 2, 31);
  print(color(`  Analyzing...`, 'red', 'bright blink'), 2, 33); move(17, 33);
  
  allFiles = [];
  function checkDir(dir, deep = 0) {
    if (deep > 20) { return 0; }
    let size = 0;
    getDirList(dir).forEach(file => {      
      file.relativePath = file.path.split(fromPath).join('');
      allFiles.push(file);
      if (file.type === 'dir' && !excludeDirs.find(d => d.isExcluded && d.name === file.name)) {
        file.size = checkDir(file.path, deep + 1); // recursive check to subdirectory
      };
      size += file.size;
    });
    return size;
  }


  const totalSize = checkDir(rootDir);

  const files = allFiles.filter(f => f.type === 'file');
  const dirs = allFiles.filter(f => f.type === 'dir');
  // const totalSize = files.reduce((acc, file) => file.size + acc, 0);
  function result() {
    print(repeat(width1, ' '), 1, 33);
    print(` - Size    : ${yellow(formatSize(totalSize))}`,  2, 33);
    print(` - Files   : ${yellow(files.length)}`,           2, 34);
    print(` - Subdirs : ${yellow(dirs.length)}`,            2, 35);
    cdDirA(fromPath);
    printOptions();
  }

  if (delay === 0) { result(); }
  else { setTimeout(() => result(), delay); }
}


// copy /home/barba/AAA.tmp/jb-icomoon /home/barba/AA2.tmp
//   fromPath = '/home/barba/AAA.tmp/jb-icomoon';
//     toPath = '/home/barba/AA2.tmp';

function preCopyScan() {
  status = 4;
  print(repeat(width1 + width2 + width3, ' '), 2, height + 10);
  print(green(`Scanning original content...`), 2, height + 10);

  analyseDir(fromPath);
  getNewFolderName(); // Find the new folder name (with renames if alredy exists)

  status = 5;
  op = 1; 
  printConfirm();
  if (autoRun) { startCopy(); }
}


async function startCopy() {
  const x = 1, y = height + 10;
  const progressBarWidth = 50;
  let isErr = false;
  status = 6;

  const dirName = fromPath.split('/').reverse()[0]; // Single name of the directory to duplicate
  const newFolder = getNewFolderName();

  allFiles.forEach(file => file.newPath = newFolder + file.relativePath); // shortcut to new path

  const dirs = allFiles.filter(f => f.type === 'dir');

  // ---- Create the new directory and all its subdirectories ----
  print(repeat(width, ' '), x, y);
  print(green(`Creating new directory structure: `), 2, y);
  print(green(repeat(progressBarWidth, `░`)), 36, y);

  try { fs.mkdirSync(newFolder); }
  catch(err) { 
    print(red(`Error: "${dirName}" directory cannot be created (already exists?)`), 2, y + 2);
    await sleep(2000);
    return backToStart();
  }

  for (let t = 0; t < dirs.length; t++) {
    const path = dirs[t].newPath;
    try { fs.mkdirSync(path); }
    catch(err) { 
      print(red(`Error: "${dirName}" directory cannot be created`.padEnd(width - 50, ' ')), 2, y + 2);
      isErr = true; break; 
    }

    let progress = Math.round(progressBarWidth * t / (dirs.length - 1));
    let progressPer = Math.round(100 * t / (dirs.length - 1));
    print(green(repeat(progress, `█`)), 36, y);
    print(green(`${progressPer} %`), 36 + progressBarWidth + 2, y);
    move(36 +  progress, y);
    // await sleep(200);
  }

  if (isErr) { return backToStart(); } // Safe stop point in case of error

  copyFiles();
}


let errorFile; // pointer to the last file that failed when copying

async function copyFiles(errOp = '') {
  const x = 1, y = height + 10;
  const progressBarWidth = 50;
  let isErr = false;
  status = 6;

  const files = allFiles.filter(f => f.type === 'file');
  const totalSize = files.reduce((acc, file) => file.size + acc, 0);

  // files[4].path += 'X'; // force copy file error to test
  // files[12].path += 'XXXX'; // force copy file error to test

  // ------------------------- Copy files -------------------------
  print(repeat(width, ' '), x, y - 2);
  print(repeat(width, ' '), x, y - 1);
  print(repeat(width, ' '), x, y);
  print(repeat(width, ' '), x, y + 1);
  print(repeat(width, ' '), x, y + 2);
  print(green(`Copying files: `), 2, y);
  print(green(repeat(progressBarWidth, `░`)), 36, y);

  getNewFolderName(); // Leave this here to print the action

  let sizeCount = 0;
  let errCount = 0;
  const totalFiles = files.length;

  for (let t = 0; t < files.length; t++) {
    const file = files[t];

    print(green(`${t+1} of ${totalFiles}`), 18, y);
    print(`File: ${file.path.padEnd(width - 10, ' ').slice(0, width - 10)}`, 2, y + 2);

    if (!file.copied) {
      try { fs.copyFileSync(file.path, file.newPath); }
      catch(err) {
        print(repeat(width, ' '), x, y + 3);
        print(red(`Error: Cannot copy file: ${file.path}`), 2, y + 2);
        if (errOp === 'ignore') {
          errCount++;

        } else { // Stop and ask what to do with the error
          print(`Press "${cyan('Enter')}" to retry`, 100, y - 2);
          print(`Press "${cyan('s')}" to skip and continue`, 100, y - 1);
          print(`Press "${cyan('y')}" to skip and continue and ignore future errors`, 100, y);
          print(`Press "${cyan('Esc')}" to cancel`, 100, y + 1);
          errorFile = file;
          status = 7;
          isErr = true;
          break;
        }
      }
      file.copied = true; // mark it as successfully copied
    }


    sizeCount += file.size;
    let pRef = sizeCount / totalSize;
    let progress = Math.round(progressBarWidth * pRef);
    let progressPer = Math.round(100 * pRef);
    print(green(repeat(progress, `█`)), 36, y);
    print(green(`${progressPer} %`), 36 + progressBarWidth + 2, y);
    move(36 +  progress, y);
    // await sleep(100);
  }

  if (isErr) { return; } // Safe stop point in case of error

  // Successfully finished
  status = 8;
  print(repeat(width, ' '), x, y + 2);
  print(green(`Copy successfully finised ✓`), 2, y + 2);
  if (errorFile) { print(red(`(but with ${errCount} errors)`), 30, y + 2); }
  move(1, height + 14);
  process.exit(0);
}




