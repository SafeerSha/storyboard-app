import re
import os

filepath = "components/StoryEditor.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

read_only = []
epic_assignment = []
story_title = []
story_desc = []
story_reviewers = []
ac = []
assumptions = []
clarifications = []
general_fb = []

current_block = None
new_lines = []
in_body = False

i = 0
while i < len(lines):
    line = lines[i]
    
    if "{/* Read-Only Warning Banner */}" in line:
        current_block = read_only
        in_body = True
    elif "{/* Epic Assignment */}" in line:
        current_block = epic_assignment
    elif "{/* Story Title */}" in line:
        current_block = story_title
    elif "{/* Story Description */}" in line:
        current_block = story_desc
    elif "{/* Story Reviewers Section */}" in line:
        current_block = story_reviewers
    elif '<div className="border-t border-[rgba(74,61,100,0.06)] my-4" />' in line:
        current_block = None
        i += 1
        continue
    elif "{/* 1. Acceptance Criteria */}" in line:
        current_block = ac
    elif "{/* 2. Assumptions */}" in line:
        current_block = assumptions
    elif "{/* 3. Clarifications */}" in line:
        current_block = clarifications
    elif "{/* General Story Feedback section */}" in line:
        current_block = general_fb
    elif "{/* Action Footer */}" in line:
        in_body = False
        current_block = None
        
        # Insert the refactored body right before the Action Footer
        refactored_body = [
            '      {layout === "standalone" ? (',
            '        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 sm:gap-8 mt-6">',
            '          <div className="space-y-5 sm:space-y-6">',
        ]
        refactored_body.extend(read_only)
        refactored_body.extend(story_title)
        refactored_body.extend(story_desc)
        refactored_body.extend(ac)
        refactored_body.extend([
            '          </div>',
            '          <div className="space-y-5 sm:space-y-6">',
        ])
        refactored_body.extend(epic_assignment)
        refactored_body.extend(story_reviewers)
        refactored_body.extend(assumptions)
        refactored_body.extend(clarifications)
        refactored_body.extend(general_fb)
        refactored_body.extend([
            '          </div>',
            '        </div>',
            '      ) : (',
            '        <div className="space-y-5 sm:space-y-6 mt-5">',
        ])
        refactored_body.extend(read_only)
        refactored_body.extend(epic_assignment)
        refactored_body.extend(story_title)
        refactored_body.extend(story_desc)
        refactored_body.extend(story_reviewers)
        refactored_body.append('          <div className="border-t border-[rgba(74,61,100,0.06)] my-4" />')
        refactored_body.extend(ac)
        refactored_body.extend(assumptions)
        refactored_body.extend(clarifications)
        refactored_body.extend(general_fb)
        refactored_body.extend([
            '        </div>',
            '      )}',
            ''
        ])
        new_lines.extend(refactored_body)
        new_lines.append(line)
        i += 1
        continue
        
    if in_body and current_block is not None:
        current_block.append(line)
    elif not in_body:
        new_lines.append(line)
            
    i += 1

with open(filepath, "w", encoding="utf-8") as f:
    f.write("\n".join(new_lines))

print("Refactored successfully!")
