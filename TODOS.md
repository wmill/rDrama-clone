# Performance issues when rendering a large number of comments.
Not addressing these right now, but look into it for later. 
- lucide-react uses inline svg elements. These static resources end up being mirrored hundreds of times in the DOM as trees of elements. Switch over to svgs in img tags, as the browser is smarter about reusing those.
    - note, we will need to colorize the svg icons as they use inline colors which will be unavailable inside an image tag.
- The tanstack router Link element is a bit slow. It does non-trivial work. Comments should probably use interpolatePath / buildLocation with straight anchor elements to improve performance. 