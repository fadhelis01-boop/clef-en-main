# Icônes PNG sans dépendance : fond bleu nuit, maison ambre, clé blanche.
import zlib, struct, os
def png(w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y*w*4:(y+1)*w*4]) for y in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b'')
def make(S, maskable):
    px = bytearray(S*S*4)
    bg=(0x1E,0x2A,0x38); amber=(0xE3,0xA0,0x38); white=(0xFF,0xFF,0xFF); brick=(0xB5,0x48,0x2E)
    rc = 0 if maskable else S*0.22
    sc = 0.60 if maskable else 0.78
    x0=S*(1-sc)/2; y0=S*(1-sc)/2; W=S*sc
    for y in range(S):
        for x in range(S):
            inside=True
            if rc:
                cx=min(max(x,rc),S-1-rc); cy=min(max(y,rc),S-1-rc); inside=(x-cx)**2+(y-cy)**2<=rc**2
            if not inside: c=(0,0,0); a=0
            else:
                c=bg; a=255
                u=(x-x0)/W; v=(y-y0)/W
                # toit (triangle)
                if 0.08<=v<=0.45 and abs(u-0.5) <= (v-0.08)*1.15: c=brick
                # corps de la maison
                if 0.42<=v<=0.92 and 0.2<=u<=0.8: c=amber
                # clé : anneau + tige
                kx,ky,r=0.5,0.58,0.11
                d2=(u-kx)**2+(v-ky)**2
                if d2<=r**2 and d2>=(r*0.45)**2: c=white
                if 0.47<=u<=0.53 and 0.68<=v<=0.86: c=white
                if 0.53<=u<=0.6 and (0.76<=v<=0.79 or 0.82<=v<=0.85): c=white
            i=(y*S+x)*4; px[i:i+4]=bytes((c[0],c[1],c[2],a))
    return png(S,S,px)
d=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','icons')
open(os.path.join(d,'icon-192.png'),'wb').write(make(192,False))
open(os.path.join(d,'icon-512.png'),'wb').write(make(512,False))
open(os.path.join(d,'icon-maskable-512.png'),'wb').write(make(512,True))
print('icônes : ok')
