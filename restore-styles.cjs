const { execSync } = require('child_process');
const fs = require('fs');

const oldFile = execSync('git show HEAD:apps/mobile/src/components/PostCard.tsx').toString();
const stylesIndex = oldFile.indexOf('const styles = StyleSheet.create({');

if (stylesIndex > -1) {
  const stylesBlock = oldFile.substring(stylesIndex);
  
  let currentFile = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');
  currentFile += '\n\n' + stylesBlock;
  fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', currentFile, 'utf8');
  console.log('Styles restored successfully!');
}
