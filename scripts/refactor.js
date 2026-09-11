const fs = require('fs');

const filepath = "components/StoryEditor.tsx";
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

const read_only = [];
const epic_assignment = [];
const story_title = [];
const story_desc = [];
const story_reviewers = [];
const ac = [];
const assumptions = [];
const clarifications = [];
const general_fb = [];

let current_block = null;
const new_lines = [];
let in_body = false;

let i = 0;
while (i < lines.length) {
    const line = lines[i];
    
    if (line.includes("{/* Read-Only Warning Banner */}")) {
        current_block = read_only;
        in_body = true;
    } else if (line.includes("{/* Epic Assignment */}")) {
        current_block = epic_assignment;
    } else if (line.includes("{/* Story Title */}")) {
        current_block = story_title;
    } else if (line.includes("{/* Story Description */}")) {
        current_block = story_desc;
    } else if (line.includes("{/* Story Reviewers Section */}")) {
        current_block = story_reviewers;
    } else if (line.includes('<div className="border-t border-[rgba(74,61,100,0.06)] my-4" />')) {
        current_block = null;
        i++;
        continue;
    } else if (line.includes("{/* 1. Acceptance Criteria */}")) {
        current_block = ac;
    } else if (line.includes("{/* 2. Assumptions */}")) {
        current_block = assumptions;
    } else if (line.includes("{/* 3. Clarifications */}")) {
        current_block = clarifications;
    } else if (line.includes("{/* General Story Feedback section */}")) {
        current_block = general_fb;
    } else if (line.includes("{/* Action Footer */}")) {
        in_body = false;
        current_block = null;
        
        const refactored_body = [
            '      {layout === "standalone" ? (',
            '        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 sm:gap-8 mt-6">',
            '          <div className="space-y-5 sm:space-y-6">',
            ...read_only,
            ...story_title,
            ...story_desc,
            ...ac,
            '          </div>',
            '          <div className="space-y-5 sm:space-y-6">',
            ...epic_assignment,
            ...story_reviewers,
            ...assumptions,
            ...clarifications,
            ...general_fb,
            '          </div>',
            '        </div>',
            '      ) : (',
            '        <div className="space-y-5 sm:space-y-6 mt-5">',
            ...read_only,
            ...epic_assignment,
            ...story_title,
            ...story_desc,
            ...story_reviewers,
            '          <div className="border-t border-[rgba(74,61,100,0.06)] my-4" />',
            ...ac,
            ...assumptions,
            ...clarifications,
            ...general_fb,
            '        </div>',
            '      )}',
            ''
        ];
        
        new_lines.push(...refactored_body);
        new_lines.push(line);
        i++;
        continue;
    }
    
    if (in_body && current_block !== null) {
        current_block.push(line);
    } else if (!in_body) {
        new_lines.push(line);
    }
    
    i++;
}

fs.writeFileSync(filepath, new_lines.join('\n'), 'utf8');
console.log("Refactored successfully!");
