# Membangkitkan pasangan DTM/STR sintetis dengan tata letak yang diverifikasi pada sampel site:
#  STR: header, record sumbu, record "string, Y, X, Z, , d1", pemisah "0,...", penutup "0,..., END"
#  DTM: header merujuk STR, blok titik salinan (diabaikan), OBJECT, TRISOLATION, "id, v1, v2, v3, n1, n2, n3,"
#  Indeks vertex = nomor record STR setelah record sumbu (pemisah ikut dinomori). CRLF.
import sys, os
out = sys.argv[1]
E0, N0 = 700000.0, 9100000.0
cols = [0, 20, 40, 55, 75, 100]; zs = [120, 120, 130, 130, 140, 140]
recs = []  # list of lines after axis; record number = index+1
south = []; north = []
for c, z in zip(cols, zs):
    recs.append(f"1, {N0-20:.3f}, {E0+c:.3f}, {z:.3f}, ,1"); south.append(len(recs))
recs.append("0, 0.000, 0.000, 0.000,")
for c, z in zip(cols, zs):
    recs.append(f"2, {N0+20:.3f}, {E0+c:.3f}, {z:.3f}, ,1"); north.append(len(recs))
recs.append("0, 0.000, 0.000, 0.000,")
recs.append("0, 0.000, 0.000, 0.000, END")
strlines = ["bench,04-Nov-26,,", "0,           0.000,           0.000,           0.000,           0.000,           0.000,           0.000"] + recs
tris = []
for i in range(len(cols) - 1):
    sw, se, ne, nw = south[i], south[i+1], north[i+1], north[i]
    tris.append((sw, se, ne)); tris.append((sw, ne, nw))
edge = {}
for t, (a, b, c) in enumerate(tris, start=1):
    for e in ((a, b), (b, c), (c, a)):
        edge.setdefault(frozenset(e), []).append(t)
dtm = ["bench.str,0000000000;algorithm=standard;fields=x,y",
       recs[0].rsplit(",", 2)[0] + ", ", recs[7].rsplit(",", 2)[0] + ", ", "0, 0.000, 0.000, 0.000, ",
       "OBJECT, 1, ", "TRISOLATION, 1, neighbours=yes,validated=true,closed=no,algorithm=retriangulation"]
for t, (a, b, c) in enumerate(tris, start=1):
    nb = []
    for e in ((a, b), (b, c), (c, a)):
        o = [x for x in edge[frozenset(e)] if x != t]
        nb.append(o[0] if o else 0)
    dtm.append(f"{t}, {a}, {b}, {c}, {nb[0]}, {nb[1]}, {nb[2]}, ")
dtm.append("END")
for name, lines in (("bench.str", strlines), ("bench.dtm", dtm)):
    with open(os.path.join(out, name), "w", newline="") as f:
        f.write("\r\n".join(lines) + "\r\n")
print(len(tris), "segitiga,", len([r for r in recs if not r.startswith("0")]), "titik STR,", len(recs), "record setelah sumbu")
