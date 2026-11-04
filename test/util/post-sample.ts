export const DummyPost = {
  id: '66bc7a27e1c123456789',
  type: 'blog',
  title: 'How to Integrate Editor.js with NestJS',
  slug: 'integrate-editorjs-with-nestjs-4',
  postContent: {
    json: {
      time: 1723600000000,
      blocks: [
        {
          type: 'header',
          data: {
            text: 'Integrating Editor.js in Your Backend',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          data: {
            text: "In this guide, we'll walk through integrating Editor.js with a NestJS backend...",
          },
        },
        {
          type: 'image',
          data: {
            file: {
              url: 'https://pub-c30fee4d40e1428ba678b04c9e785bdc.r2.dev/active/posts/test-avatar.png',
            },
            caption: 'Example Image',
            withBorder: false,
            stretched: false,
            withBackground: false,
          },
        },
      ],
      version: '2.28.2',
    },
    html: '<h2>Integrating Editor.js in Your Backend</h2><p>In this guide, we\'ll walk through integrating Editor.js with a NestJS backend...</p><img src="https://cdn.example.com/editor-images/image1.png" alt="Example Image">',
  },
  postSeo: {
    seoTitle: 'Editor.js Integration with NestJS',
    seoDescription:
      'A step-by-step guide to integrating Editor.js with a NestJS backend application.',
    seoKeywords: ['Editor.js', 'NestJS', 'Rich Text Editor', 'Node.js'],
  },
  coverImage: 'test-avatar.png',
  embeddedImagesUrl: ['test-avatar.png'],
  tags: ['NestJS', 'Editor.js', 'Content Management'],
}
