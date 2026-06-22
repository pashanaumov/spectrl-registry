# Part 4: Discovery & Information Commands

## 7. SEARCH COMMAND

### 7.1 Search - Basic Queries

- [ ] Search by keyword: `spectrl search api`
- [ ] Verify results displayed
- [ ] Verify results relevant
- [ ] Search by tag: `spectrl search rest`
- [ ] Search by author: `spectrl search username`
- [ ] Search with multiple words: `spectrl search "api design"`
- [ ] Search with special characters
- [ ] Search with unicode characters

### 7.2 Search - Result Display

- [ ] Verify spec name shown
- [ ] Verify author shown
- [ ] Verify latest version shown
- [ ] Verify description shown
- [ ] Verify tags shown
- [ ] Verify download count shown (if available)
- [ ] Verify results formatted clearly
- [ ] Verify results paginated if many

### 7.3 Search - Edge Cases

- [ ] Search with no results
- [ ] Search with empty query
- [ ] Search with very long query
- [ ] Search without internet (should fail gracefully)
- [ ] Search with API down
- [ ] Search with timeout
- [ ] Search with special regex characters
- [ ] Search with SQL injection attempt
- [ ] Search with XSS attempt

### 7.4 Search - Performance

- [ ] Search returns within 3 seconds
- [ ] Search with 1000+ results
- [ ] Search with very common term
- [ ] Search with very rare term
- [ ] Multiple searches in succession

## 8. INFO COMMAND

### 8.1 Info - Basic Usage

- [ ] Run: `spectrl info username/spec-name`
- [ ] Verify spec name displayed
- [ ] Verify author displayed
- [ ] Verify all versions listed
- [ ] Verify latest version highlighted
- [ ] Verify description shown
- [ ] Verify tags shown
- [ ] Verify dependencies shown
- [ ] Verify file list shown
- [ ] Verify published dates shown

### 8.2 Info - Version Details

- [ ] Info shows all available versions
- [ ] Info shows version publish dates
- [ ] Info shows version descriptions
- [ ] Info shows version-specific dependencies
- [ ] Info shows version file changes

### 8.3 Info - Edge Cases

- [ ] Info on non-existent spec (should fail gracefully)
- [ ] Info on spec with no versions
- [ ] Info on spec with many versions (>50)
- [ ] Info without internet
- [ ] Info with API down
- [ ] Info with invalid spec format
- [ ] Info with special characters in name

## 9. LIST COMMAND

### 9.1 List - Installed Specs

- [ ] Install several specs
- [ ] Run: `spectrl list`
- [ ] Verify all installed specs shown
- [ ] Verify versions shown
- [ ] Verify source shown (local vs public)
- [ ] Verify install location shown
- [ ] Verify formatted clearly

### 9.2 List - Empty State

- [ ] Run list with no specs installed
- [ ] Verify friendly message shown
- [ ] Verify suggests next steps

### 9.3 List - Mixed Sources

- [ ] Install local specs
- [ ] Install public specs
- [ ] Run list
- [ ] Verify both types shown
- [ ] Verify source clearly indicated
- [ ] Verify grouped or sorted logically

### 9.4 List - Edge Cases

- [ ] List with corrupted lock file
- [ ] List with missing registry files
- [ ] List with broken symlinks
- [ ] List with many specs (>100)
- [ ] List in project without init
- [ ] List with read permission issues
