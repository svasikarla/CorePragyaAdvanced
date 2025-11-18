# Knowledge Graph Feature - Setup & Testing Guide

## Overview

The Knowledge Graph feature visualizes connections between your knowledge base entries using an interactive 2D/3D force-directed graph. This guide will help you set up and test the feature.

## What Was Implemented

### 1. Database Layer
- **New Table**: `knowledge_graph_links` - Stores relationships between knowledge entries
- **Columns**: source_kb_id, target_kb_id, link_type, link_strength, shared_keywords
- **Indexes**: Optimized for fast queries on user_id, source, target, and strength
- **RLS Policies**: Row-level security ensures users only see their own connections

### 2. API Endpoints
- **GET /api/knowledge-graph/data** - Fetches graph data (nodes and links)
- **POST /api/knowledge-graph/generate-links** - Auto-generates connections based on keyword similarity

### 3. Frontend Components
- **2D Force Graph** - Interactive Canvas-based visualization
- **3D Force Graph** - WebGL-based 3D visualization
- **Controls**: Zoom, pan, pause, reset view
- **Node Info Panel**: Click any node to see details
- **Legend**: Category color coding

### 4. Navigation
- Added "View Graph" button to Knowledge Base page
- Added "View Graph" button to Dashboard page

## Setup Instructions

### Step 1: Run Database Migration

```bash
# Make sure you're in the project root
cd /home/user/CorePragyaAdvanced

# Run the migration script
node scripts/create-knowledge-graph-links-table.js
```

**Expected Output:**
```
Creating knowledge_graph_links table...
✓ Knowledge graph links table created successfully
✓ Indexes created
✓ RLS policies enabled
✓ Triggers configured
✓ Script completed successfully
```

**If the script fails:**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/create_knowledge_graph_links_table.sql`
4. Paste and execute the SQL

### Step 2: Verify Dependencies

The required packages should already be installed. To verify:

```bash
npm list react-force-graph-2d react-force-graph-3d three
```

If missing, install with:

```bash
npm install react-force-graph-2d react-force-graph-3d three @types/three --legacy-peer-deps
```

### Step 3: Start the Development Server

```bash
npm run dev
```

The app should start at http://localhost:3000

## Testing the Feature

### Test 1: Access the Knowledge Graph Page

1. **Navigate to Knowledge Base**
   - Go to http://localhost:3000/knowledge-base
   - Log in if not already logged in

2. **Click "View Graph" Button**
   - You should see a prominent blue "View Graph" button in the header
   - Click it to navigate to the knowledge graph page

3. **Expected Behavior:**
   - If you have NO entries: You'll see a message "No Knowledge Graph Yet"
   - If you have entries but NO links: You'll see disconnected nodes
   - The page should load without errors

### Test 2: Generate Connections

1. **Prerequisites:**
   - You need at least 2-3 knowledge base entries
   - If you don't have any, add some via the Knowledge Base page

2. **Generate Links:**
   - Click the "Generate Links" button (with sparkle icon)
   - Wait for the process to complete (usually 2-10 seconds)
   - You should see an alert showing how many connections were created

3. **Expected Result:**
   - Links (lines) appear between related nodes
   - Nodes with similar keywords will be connected
   - Entries in the same category may have connections

### Test 3: Interact with the Graph

**2D View (Default):**
- **Zoom**: Use mouse wheel or zoom buttons
- **Pan**: Click and drag the background
- **Move Nodes**: Click and drag individual nodes
- **Node Info**: Click a node to see details in sidebar
- **Labels**: Zoom in to see node labels appear

**3D View:**
- Click "3D View" button to switch
- **Rotate**: Click and drag to rotate the 3D space
- **Zoom**: Mouse wheel to zoom in/out
- **Node Info**: Click nodes to see details
- Background is black in 3D mode

**Controls:**
- **Zoom In Button**: Increases magnification
- **Zoom Out Button**: Decreases magnification
- **Fit to Screen**: Centers and fits all nodes in view
- **Pause/Play**: Freezes/resumes physics simulation

### Test 4: Verify API Endpoints

**Test Graph Data Endpoint:**
```bash
# Get your access token from browser DevTools > Application > Local Storage
# Look for supabase.auth.token

curl http://localhost:3000/api/knowledge-graph/data \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "nodes": [
    {
      "id": "uuid-here",
      "name": "Entry Title",
      "category": "Technology",
      "sourceType": "url",
      "val": 1,
      "color": "#8b5cf6",
      "connections": 2
    }
  ],
  "links": [
    {
      "source": "uuid-1",
      "target": "uuid-2",
      "value": 0.5,
      "type": "auto",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "stats": {
    "totalNodes": 10,
    "displayedNodes": 10,
    "totalLinks": 5,
    "displayedLinks": 5
  }
}
```

**Test Generate Links Endpoint:**
```bash
curl -X POST http://localhost:3000/api/knowledge-graph/generate-links \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minSimilarity": 0.15, "maxLinks": 1000}'
```

**Expected Response:**
```json
{
  "success": true,
  "linksCreated": 12,
  "totalEntries": 10,
  "comparisons": 45,
  "message": "Successfully generated 12 connections from 10 entries"
}
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Knowledge Graph page loads without errors
- [ ] "View Graph" buttons appear on Dashboard and Knowledge Base pages
- [ ] Can navigate to /knowledge-graph
- [ ] Empty state shows when no entries exist
- [ ] "Generate Links" button works
- [ ] Connections appear after generation
- [ ] Can click nodes to see details
- [ ] Can zoom in/out
- [ ] Can pan around the graph
- [ ] Can pause/resume animation
- [ ] Can fit graph to screen
- [ ] Can switch between 2D and 3D views
- [ ] Node colors match categories
- [ ] Legend displays correctly
- [ ] Can navigate back to Knowledge Base
- [ ] Node click opens detail panel
- [ ] "View Details" button navigates to entry

## Troubleshooting

### Issue: "Failed to fetch graph data"

**Cause**: Authentication error or database connection issue

**Solution**:
1. Check if you're logged in
2. Verify Supabase environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Check browser console for detailed errors

### Issue: No connections appear

**Cause**: Entries don't have enough keyword similarity

**Solutions**:
1. Add more entries to your knowledge base (at least 5-10)
2. Ensure entries have substantial content (not just titles)
3. Try lowering the `minSimilarity` threshold:
   - Edit `/app/knowledge-graph/page.tsx`
   - Line ~76: Change `minSimilarity: 0.15` to `0.10`
4. Manually create connections by adding entries with similar topics

### Issue: Graph is too crowded/messy

**Solutions**:
1. Use the "Pause" button to stop physics simulation
2. Use "Fit to Screen" to center the view
3. Drag nodes apart manually
4. Filter by category (future enhancement)

### Issue: 3D view is black screen

**Cause**: WebGL rendering issue

**Solutions**:
1. Check if your browser supports WebGL (chrome://gpu)
2. Try a different browser (Chrome/Firefox recommended)
3. Update graphics drivers
4. Fall back to 2D view

### Issue: Performance is slow with many nodes

**Current Limitations**:
- Optimized for up to ~500 nodes
- >1000 nodes may cause lag

**Solutions**:
1. Use pagination (future enhancement)
2. Implement filtering (future enhancement)
3. Use the "Pause" button after initial layout

## Database Queries for Debugging

**Check if table exists:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'knowledge_graph_links'
);
```

**Count total links:**
```sql
SELECT COUNT(*) FROM knowledge_graph_links;
```

**View your links:**
```sql
SELECT
  kgl.*,
  kb1.title as source_title,
  kb2.title as target_title
FROM knowledge_graph_links kgl
JOIN knowledgebase kb1 ON kgl.source_kb_id = kb1.id
JOIN knowledgebase kb2 ON kgl.target_kb_id = kb2.id
WHERE kgl.user_id = 'YOUR_USER_ID'
LIMIT 10;
```

**Check strongest connections:**
```sql
SELECT
  kb1.title as from_entry,
  kb2.title as to_entry,
  kgl.link_strength,
  kgl.shared_keywords
FROM knowledge_graph_links kgl
JOIN knowledgebase kb1 ON kgl.source_kb_id = kb1.id
JOIN knowledgebase kb2 ON kgl.target_kb_id = kb2.id
WHERE kgl.user_id = 'YOUR_USER_ID'
ORDER BY kgl.link_strength DESC
LIMIT 10;
```

## Performance Metrics

**Expected Performance:**
- Page load: < 2 seconds
- Link generation (100 entries): 2-5 seconds
- Graph rendering (100 nodes): < 1 second
- Smooth interaction: 60 FPS (2D), 30-60 FPS (3D)

## Next Steps & Future Enhancements

**Phase 2 Features (Recommended):**
1. ✅ Filtering by category
2. ✅ Search within graph
3. ✅ Manual link creation/deletion
4. ✅ Export graph as image
5. ✅ Time-based graph evolution (show how knowledge grew)
6. ✅ Cluster detection and highlighting
7. ✅ Path finding between nodes
8. ✅ Keyboard shortcuts

**Phase 3 Features:**
1. ✅ Collaborative graphs (team workspaces)
2. ✅ AI-suggested connections
3. ✅ Graph-based recommendations
4. ✅ Custom node styles/icons
5. ✅ Integration with spaced repetition

## Support

If you encounter any issues not covered in this guide:

1. Check browser console for errors (F12 > Console)
2. Check server logs: `npm run dev` terminal output
3. Verify database connection in Supabase dashboard
4. Review the implementation files:
   - `/app/knowledge-graph/page.tsx` - Main component
   - `/app/api/knowledge-graph/data/route.ts` - Data API
   - `/app/api/knowledge-graph/generate-links/route.ts` - Link generation
   - `/migrations/create_knowledge_graph_links_table.sql` - Database schema

## Success Criteria

The Knowledge Graph feature is working correctly if:

✅ You can navigate to the graph page from dashboard/knowledge-base
✅ Your knowledge entries appear as colored nodes
✅ Clicking "Generate Links" creates visible connections
✅ You can interact with the graph (zoom, pan, click)
✅ Node details appear when clicked
✅ 2D/3D views both work
✅ The legend shows category colors
✅ No console errors appear
✅ Performance is smooth (no lag)

---

**Congratulations!** 🎉 You now have a fully functional Knowledge Graph feature that visualizes the connections between your knowledge base entries.
