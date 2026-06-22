# Part 6: Web Application Testing

## 12. HOMEPAGE & NAVIGATION

### 12.1 Homepage - First Visit

- [ ] Visit https://spectrl.pro
- [ ] Verify page loads within 3 seconds
- [ ] Verify hero section displays correctly
- [ ] Verify value proposition clear
- [ ] Verify code examples visible
- [ ] Verify CTA buttons present
- [ ] Verify "Get Started" button works
- [ ] Verify "Browse Specs" button works
- [ ] Verify features pills display
- [ ] Verify "How It Works" section visible
- [ ] Verify "Built for AI Era" section visible
- [ ] Verify footer displays

### 12.2 Navigation - Header

- [ ] Click logo, returns to homepage
- [ ] Click "Browse Specs" in header
- [ ] Click "Docs" in header
- [ ] Verify active page highlighted
- [ ] Verify navigation smooth (no flash)
- [ ] Test navigation with browser back button
- [ ] Test navigation with browser forward button

### 12.3 Navigation - Footer

- [ ] Click "Getting Started" in footer
- [ ] Click "Browse Specs" in footer
- [ ] Verify all footer links work
- [ ] Verify copyright year correct
- [ ] Verify footer displays on all pages

### 12.4 Theme Toggle

- [ ] Click theme toggle (sun/moon icon)
- [ ] Verify switches to dark mode
- [ ] Verify all colors update correctly
- [ ] Verify code blocks readable
- [ ] Switch back to light mode
- [ ] Verify preference persists on reload
- [ ] Verify preference persists across pages
- [ ] Test system preference detection

### 12.5 Responsive Design - Mobile

- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Verify hamburger menu if present
- [ ] Verify text readable (not too small)
- [ ] Verify buttons tappable (not too small)
- [ ] Verify no horizontal scroll
- [ ] Verify images scale correctly
- [ ] Verify code blocks scrollable

### 12.6 Responsive Design - Tablet

- [ ] Test on iPad
- [ ] Test on Android tablet
- [ ] Verify layout adapts correctly
- [ ] Verify navigation works
- [ ] Verify touch interactions work

### 12.7 Responsive Design - Desktop

- [ ] Test on 1920x1080 resolution
- [ ] Test on 1366x768 resolution
- [ ] Test on 2560x1440 resolution
- [ ] Test on ultrawide monitor
- [ ] Verify max-width constraints
- [ ] Verify content centered
- [ ] Verify no excessive whitespace

## 13. SEARCH & DISCOVERY

### 13.1 Search from Homepage

- [ ] Enter search query in homepage search
- [ ] Press Enter
- [ ] Verify redirects to /specs with query
- [ ] Verify results displayed
- [ ] Try empty search
- [ ] Try search with special characters
- [ ] Try very long search query

### 13.2 Browse Specs Page

- [ ] Visit /specs
- [ ] Verify page title correct
- [ ] Verify search form present
- [ ] Verify initial results load
- [ ] Verify results formatted correctly
- [ ] Verify pagination controls if many results
- [ ] Verify loading states shown

### 13.3 Search Results

- [ ] Search for "api"
- [ ] Verify relevant results shown
- [ ] Verify each result shows: name, author, version, description
- [ ] Verify tags displayed
- [ ] Verify download count (if available)
- [ ] Verify published date
- [ ] Click on result, goes to detail page

### 13.4 Search - No Results

- [ ] Search for gibberish: "xyzabc123notfound"
- [ ] Verify "No specs found" message
- [ ] Verify message is friendly
- [ ] Verify suggests clearing search
- [ ] Click "Clear search" button
- [ ] Verify returns to all specs

### 13.5 Search - Pagination

- [ ] Search with many results
- [ ] Verify pagination controls shown
- [ ] Click "Next" button
- [ ] Verify next page loads
- [ ] Verify URL updated with cursor
- [ ] Click "Previous" button
- [ ] Verify previous page loads
- [ ] Verify browser back/forward works
- [ ] Test direct URL with pagination cursor

### 13.6 Search - Performance

- [ ] Search returns results within 2 seconds
- [ ] Search with 100+ results
- [ ] Verify smooth scrolling
- [ ] Verify no layout shift
- [ ] Verify images lazy load

### 13.7 Search - Error Handling

- [ ] Disconnect internet, try search
- [ ] Verify error message shown
- [ ] Verify error is user-friendly
- [ ] Reconnect, try again
- [ ] Verify recovers gracefully

## 14. SPEC DETAIL PAGES

### 14.1 Spec Detail - Basic Display

- [ ] Visit /specs/username/spec-name
- [ ] Verify page loads within 3 seconds
- [ ] Verify spec name displayed prominently
- [ ] Verify author name displayed
- [ ] Verify current version displayed
- [ ] Verify description displayed
- [ ] Verify tags displayed
- [ ] Verify published date displayed
- [ ] Verify breadcrumbs work

### 14.2 Version Selector

- [ ] Verify version dropdown present
- [ ] Click version dropdown
- [ ] Verify all versions listed
- [ ] Verify current version highlighted
- [ ] Select different version
- [ ] Verify URL updates with ?v=X.X.X
- [ ] Verify content updates
- [ ] Verify install command updates
- [ ] Test browser back button
- [ ] Test direct URL with version param

### 14.3 Install Command Display

- [ ] Verify install command shown
- [ ] Verify command format correct
- [ ] Verify includes version if not latest
- [ ] Click copy button
- [ ] Verify copied to clipboard
- [ ] Verify copy button shows feedback
- [ ] Paste in terminal, verify works

### 14.4 Sidebar Info (Desktop)

- [ ] Verify sidebar visible on desktop
- [ ] Verify shows author
- [ ] Verify shows published date
- [ ] Verify shows download count (if available)
- [ ] Verify sidebar sticky on scroll
- [ ] Verify install command in sidebar

### 14.5 Mobile Install Card

- [ ] View on mobile
- [ ] Verify install card shown
- [ ] Verify positioned correctly
- [ ] Verify copy button works
- [ ] Verify readable and tappable

### 14.6 File Navigation

- [ ] Verify file list displayed
- [ ] Verify README.md shown by default
- [ ] Click different file
- [ ] Verify content updates
- [ ] Verify URL updates
- [ ] Verify syntax highlighting correct
- [ ] Verify markdown rendered correctly
- [ ] Test with nested directories
- [ ] Test with many files (>20)

### 14.7 File Content Display

- [ ] Verify markdown files rendered
- [ ] Verify code blocks syntax highlighted
- [ ] Verify images display (if any)
- [ ] Verify links work
- [ ] Verify tables formatted
- [ ] Verify lists formatted
- [ ] Verify headings styled correctly
- [ ] Verify long lines wrap or scroll

### 14.8 Spec Detail - Edge Cases

- [ ] Visit non-existent spec
- [ ] Verify 404 page shown
- [ ] Verify 404 page helpful
- [ ] Visit with invalid version param
- [ ] Verify defaults to latest
- [ ] Visit spec with no files
- [ ] Visit spec with no README
- [ ] Visit spec with very long description
- [ ] Visit spec with many tags (>10)

### 14.9 Spec Detail - Performance

- [ ] Page loads within 3 seconds
- [ ] File switching instant
- [ ] Version switching smooth
- [ ] Large files (>1MB) load progressively
- [ ] Images lazy load
- [ ] No layout shift on load

### 14.10 Spec Detail - Error Handling

- [ ] Disconnect internet, visit page
- [ ] Verify error message
- [ ] Reconnect, verify recovers
- [ ] API returns 500 error
- [ ] Verify error message shown
- [ ] File fails to load
- [ ] Verify fallback message
